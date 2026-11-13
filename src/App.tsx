import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { Bold, Italic, Strikethrough, Code2, Heading1, Heading2, List, ListOrdered, Quote, Undo2, Redo2, FolderOpen, Save, FilePlus2, FileText, CircleHelp } from 'lucide-react';

const WELCOME = `# Welcome to Inkdown\n\nA local-first editor with **live Markdown** formatting.\n\nTry typing these in the editor:\n\n- \`\` around a word for inline code\n- \`**bold**\` or \`*italic*\`\n- \`~~strikethrough~~\`\n- \`# \` at the start of a line for a heading\n- \`- \` at the start of a line for a list\n\n**Files are saved as plain Markdown**, so Git can track your changes.\n`;

export default function App() {
  const [path, setPath] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState('Ready');
  const [help, setHelp] = useState(false);
  const [revision, setRevision] = useState(0);
  const dirtyRef = useRef(false);
  const pathRef = useRef<string | null>(null);
  const busy = useRef(false);
  const markDirty = (value: boolean) => { dirtyRef.current = value; setDirty(value); };
  const updatePath = (value: string | null) => { pathRef.current = value; setPath(value); };

  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: WELCOME,
    contentType: 'markdown',
    editorProps: { attributes: { class: 'editor-body', spellcheck: 'true', 'aria-label': 'Markdown document editor' } },
    onUpdate: () => { if (!busy.current) markDirty(true); setRevision(r => r + 1); },
  });

  const confirmReplace = () => !dirtyRef.current || window.confirm('You have unsaved changes. Discard them?');
  const newFile = useCallback(() => {
    if (!editor || !confirmReplace()) return;
    busy.current = true;
    editor.commands.setContent('', { contentType: 'markdown' });
    busy.current = false;
    updatePath(null); markDirty(false); setNotice('New document'); editor.commands.focus();
  }, [editor]);

  const openFile = useCallback(async () => {
    if (!editor || !confirmReplace()) return;
    if (!isTauri()) { setNotice('Open files in the Tauri desktop app'); return; }
    try {
      const selected = await open({ multiple: false, directory: false, filters: [{ name: 'Markdown', extensions: ['md','markdown','txt'] }] });
      if (typeof selected !== 'string') return;
      const contents = await invoke<string>('read_markdown', { path: selected });
      busy.current = true;
      editor.commands.setContent(contents, { contentType: 'markdown' });
      busy.current = false;
      updatePath(selected); markDirty(false); setNotice('Opened document');
    } catch (err) { busy.current = false; setNotice(`Open failed: ${String(err)}`); }
  }, [editor]);

  const saveFile = useCallback(async (forceDialog = false) => {
    if (!editor) return;
    if (!isTauri()) { setNotice('Save files in the Tauri desktop app'); return; }
    try {
      let destination = forceDialog ? null : pathRef.current;
      if (!destination) destination = await save({ defaultPath: pathRef.current ?? 'untitled.md', filters: [{ name: 'Markdown', extensions: ['md'] }] });
      if (!destination) return;
      const content = editor.getMarkdown();
      await invoke('write_markdown', { path: destination, content });
      updatePath(destination); markDirty(false); setNotice('Saved');
    } catch (err) { setNotice(`Save failed: ${String(err)}`); }
  }, [editor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.key.toLowerCase() === 's') { e.preventDefault(); void saveFile(e.shiftKey); }
      if (e.key.toLowerCase() === 'o') { e.preventDefault(); void openFile(); }
      if (e.key.toLowerCase() === 'n') { e.preventDefault(); newFile(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveFile, openFile, newFile]);
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => { if (dirtyRef.current) e.preventDefault(); };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  const filename = path?.replace(/\\/g, '/').split('/').pop() ?? 'Untitled.md';
  const wordCount = editor?.getText().trim().split(/\s+/).filter(Boolean).length ?? 0;
  void revision;
  const Tool = ({ label, active = false, disabled = false, onClick, children }: { label: string, active?: boolean, disabled?: boolean, onClick: () => void, children: React.ReactNode }) =>
    <button type="button" title={label} aria-label={label} aria-pressed={active} className={`tool ${active ? 'active' : ''}`} disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={onClick}>{children}</button>;
  return <div className="app">
    <header className="topbar"><div className="brand"><span className="brand-icon">✳</span><span>Inkdown</span></div><div className="document-name"><FileText size={15}/>{filename}{dirty && <span className="unsaved" title="Unsaved changes"/>}</div><div className="top-actions"><button onClick={newFile} title="New (Ctrl+N)"><FilePlus2 size={16}/> New</button><button onClick={() => void openFile()} title="Open (Ctrl+O)"><FolderOpen size={16}/> Open</button><button className="primary" onClick={() => void saveFile()} title="Save (Ctrl+S)"><Save size={16}/> Save</button></div></header>
    <div className="toolbar"><div className="toolset">
      <Tool label="Bold (Ctrl+B)" active={!!editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={17}/></Tool>
      <Tool label="Italic (Ctrl+I)" active={!!editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={17}/></Tool>
      <Tool label="Strike" active={!!editor?.isActive('strike')} onClick={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough size={17}/></Tool>
      <Tool label="Inline code" active={!!editor?.isActive('code')} onClick={() => editor?.chain().focus().toggleCode().run()}><Code2 size={17}/></Tool>
    </div><div className="separator"/><div className="toolset">
      <Tool label="Heading 1" active={!!editor?.isActive('heading', {level: 1})} onClick={() => editor?.chain().focus().toggleHeading({level:1}).run()}><Heading1 size={19}/></Tool>
      <Tool label="Heading 2" active={!!editor?.isActive('heading', {level: 2})} onClick={() => editor?.chain().focus().toggleHeading({level:2}).run()}><Heading2 size={19}/></Tool>
      <Tool label="Bullet list" active={!!editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={18}/></Tool>
      <Tool label="Numbered list" active={!!editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={18}/></Tool>
      <Tool label="Blockquote" active={!!editor?.isActive('blockquote')} onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote size={18}/></Tool>
    </div><div className="separator"/><div className="toolset">
      <Tool label="Undo" disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}><Undo2 size={17}/></Tool>
      <Tool label="Redo" disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}><Redo2 size={17}/></Tool>
    </div><span className="toolbar-spacer"/><Tool label="Help" onClick={() => setHelp(v => !v)}><CircleHelp size={17}/></Tool></div>
    <main className="workspace"><div className="page"><EditorContent editor={editor}/></div></main>
    {help && <div className="help-panel"><button className="close" onClick={() => setHelp(false)}>×</button><h3>Live Markdown</h3><p>Type complete Markdown markers and the editor turns them into rich formatting.</p><p><code>**bold**</code> · <code>*italic*</code> · <code>`code`</code> · <code>~~strike~~</code></p><p>Start a new line with <code># </code>, <code>- </code>, or <code>1. </code> for headings and lists.</p><p><strong>Shortcuts:</strong> Ctrl+S save, Ctrl+Shift+S save as, Ctrl+O open, Ctrl+N new.</p><p>Open the saved Markdown folder in Git to version-control your notes.</p></div>}
    <footer className="status"><span>{notice}</span><span>{wordCount} words <span className="dot">·</span> Markdown <span className="dot">·</span> {dirty ? 'Unsaved' : 'Saved'}</span></footer>
  </div>;
}
