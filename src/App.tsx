import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { CodeBlock } from './codeBlock';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import {
  Bold,
  Italic,
  Strikethrough,
  Code2,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  SquareCode,
  Undo2,
  Redo2,
  FolderOpen,
  Save,
  FilePlus2,
  FileText,
  CircleHelp,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  PageBreaks,
  PAGE_W,
  PAGE_H,
  PAD_X,
  PAD_Y,
  PAGE_GAP,
  CONTENT_H,
  computeStackBreaks,
  spreadPageCount,
} from './pageBreaks';

export default function App() {
  const [path, setPath] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState('Ready');
  const [help, setHelp] = useState(false);
  const [revision, setRevision] = useState(0);
  const dirtyRef = useRef(false);
  const pathRef = useRef<string | null>(null);
  const busy = useRef(false);
  const untitledRef = useRef('Untitled.md');
  const [untitledName, setUntitledName] = useState('Untitled.md');
  const [nameDraft, setNameDraft] = useState('Untitled.md');
  const markDirty = (value: boolean) => {
    dirtyRef.current = value;
    setDirty(value);
  };
  const updatePath = (value: string | null) => {
    pathRef.current = value;
    setPath(value);
  };

  const editor = useEditor({
    extensions: [StarterKit.configure({ codeBlock: false }), CodeBlock, Markdown, PageBreaks],
    contentType: 'markdown',
    editorProps: { attributes: { class: 'editor-body', spellcheck: 'true', 'aria-label': 'Markdown document editor' } },
    onUpdate: () => {
      if (!busy.current) markDirty(true);
      setRevision((r) => r + 1);
    },
    onSelectionUpdate: () => setRevision((r) => r + 1),
  });

  const confirmReplace = () => !dirtyRef.current || window.confirm('You have unsaved changes. Discard them?');
  const newFile = useCallback(() => {
    if (!editor || !confirmReplace()) return;
    busy.current = true;
    editor.commands.setContent('', { contentType: 'markdown' });
    busy.current = false;
    updatePath(null);
    untitledRef.current = 'Untitled.md';
    setUntitledName('Untitled.md');
    markDirty(false);
    setNotice('New document');
    editor.commands.focus();
  }, [editor]);

  const openFile = useCallback(async () => {
    if (!editor || !confirmReplace()) return;
    if (!isTauri()) {
      setNotice('Open files in the Tauri desktop app');
      return;
    }
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
      });
      if (typeof selected !== 'string') return;
      const contents = await invoke<string>('read_markdown', { path: selected });
      busy.current = true;
      editor.commands.setContent(contents, { contentType: 'markdown' });
      busy.current = false;
      updatePath(selected);
      markDirty(false);
      setNotice('Opened document');
    } catch (err) {
      busy.current = false;
      setNotice(`Open failed: ${String(err)}`);
    }
  }, [editor]);

  const saveFile = useCallback(
    async (forceDialog = false) => {
      if (!editor) return;
      if (!isTauri()) {
        setNotice('Save files in the Tauri desktop app');
        return;
      }
      try {
        let destination = forceDialog ? null : pathRef.current;
        if (!destination)
          destination = await save({
            defaultPath: pathRef.current ?? untitledRef.current,
            filters: [{ name: 'Markdown', extensions: ['md'] }],
          });
        if (!destination) return;
        const content = editor.getMarkdown();
        await invoke('write_markdown', { path: destination, content });
        updatePath(destination);
        markDirty(false);
        setNotice('Saved');
      } catch (err) {
        setNotice(`Save failed: ${String(err)}`);
      }
    },
    [editor],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveFile(e.shiftKey);
      }
      if (e.key.toLowerCase() === 'o') {
        e.preventDefault();
        void openFile();
      }
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        newFile();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveFile, openFile, newFile]);
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  const workspaceRef = useRef<HTMLElement>(null);
  const [workspaceW, setWorkspaceW] = useState(1200);
  const [pages, setPages] = useState(2);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const el = workspaceRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWorkspaceW(el.clientWidth));
    ro.observe(el);
    setWorkspaceW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const spread = workspaceW >= PAGE_W * 2 + PAGE_GAP + 48;
  const pageW = spread ? PAGE_W : Math.min(PAGE_W, Math.max(workspaceW - 32, 240));

  useLayoutEffect(() => {
    if (!editor || !editor.view?.dom) return;

    const dom = editor.view.dom as HTMLElement;
    const storage = (editor.storage as unknown as Record<string, any>).pageBreaks as { breaks: Record<number, number> };
    const stride = spread ? PAGE_W + PAGE_GAP : PAGE_H + PAGE_GAP;
    let total = 2;
    let breaks: Record<number, number> = {};

    if (spread) {
      const last = dom.lastElementChild as HTMLElement | null;
      if (last) {
        const left = dom.getBoundingClientRect().left;
        let right = 0;
        for (const r of Array.from(last.getClientRects())) right = Math.max(right, r.right);
        total = spreadPageCount(Math.floor(Math.max(right - 1 - left, 0) / stride));
      }
    } else {
      // Stacked pages: push whole blocks that would straddle a page boundary onto the next page.
      const offsets: number[] = [],
        heights: number[] = [];
      editor.state.doc.forEach((_node, offset) => {
        const el = editor.view.nodeDOM(offset) as HTMLElement | null;
        if (el) {
          offsets.push(offset);
          heights.push(el.offsetHeight);
        }
      });
      const result = computeStackBreaks(heights);
      Object.entries(result.breaks).forEach(([i, margin]) => {
        breaks[offsets[Number(i)]] = margin;
      });
      total = result.pages;
    }
    setPages(total);
    if (JSON.stringify(breaks) !== JSON.stringify(storage.breaks)) {
      storage.breaks = breaks;
      editor.view.dispatch(editor.state.tr.setMeta('pageBreaks', true));
    }
    try {
      const c = editor.view.coordsAtPos(editor.state.selection.head);
      const b = dom.getBoundingClientRect();
      const idx = spread
        ? Math.floor((c.left - b.left + PAD_X) / stride)
        : Math.floor((c.top - b.top + PAD_Y) / stride);
      setCurrentPage(Math.min(Math.max(idx, 0), total - 1) + 1);
    } catch {
      /* view not ready */
    }
  }, [editor, revision, spread, pageW]);

  const turnSpread = (dir: -1 | 1) =>
    workspaceRef.current?.scrollBy({ left: dir * (PAGE_W + PAGE_GAP) * 2, behavior: 'smooth' });
  const onWheel = (e: React.WheelEvent) => {
    if (spread && pages > 2 && e.deltaX === 0 && !e.shiftKey) workspaceRef.current!.scrollLeft += e.deltaY;
  };
  const bookW = spread ? pages * PAGE_W + (pages - 1) * PAGE_GAP : pageW;
  const bookH = spread ? PAGE_H : pages * PAGE_H + (pages - 1) * PAGE_GAP;
  const bookStyle = {
    '--page-w': `${pageW}px`,
    '--page-h': `${PAGE_H}px`,
    '--book-w': `${bookW}px`,
    '--book-h': `${bookH}px`,
    '--pad-x': `${PAD_X}px`,
    '--pad-y': `${PAD_Y}px`,
    '--content-h': `${CONTENT_H}px`,
    '--cols': pages,
    '--col-gap': `${PAD_X * 2 + PAGE_GAP}px`,
    '--gap': `${PAGE_GAP}px`,
  } as React.CSSProperties;

  const filename = path?.replace(/\\/g, '/').split('/').pop() ?? untitledName;
  useEffect(() => setNameDraft(filename), [filename]);

  // Commit an edited file name: renames the file on disk if it is saved, otherwise sets the default name for Save.
  const commitName = async () => {
    let next = nameDraft.trim();
    if (!next || /[\\/:*?"<>|]/.test(next)) {
      setNotice('File names cannot be empty or contain \\ / : * ? " < > |');
      setNameDraft(filename);
      return;
    }
    if (!/\.(md|markdown|txt)$/i.test(next)) next += '.md';
    if (next === filename) return setNameDraft(filename);
    if (!pathRef.current) {
      untitledRef.current = next;
      setUntitledName(next);
      setNotice('Name set');
      return;
    }
    try {
      const renamed = await invoke<string>('rename_markdown', { path: pathRef.current, newName: next });
      updatePath(renamed);
      setNotice('Renamed');
    } catch (err) {
      setNameDraft(filename);
      setNotice(`Rename failed: ${String(err)}`);
    }
  };
  const wordCount = editor?.getText().trim().split(/\s+/).filter(Boolean).length ?? 0;
  void revision;
  const Tool = ({
    label,
    active = false,
    disabled = false,
    onClick,
    children,
  }: {
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`tool ${active ? 'active' : ''}`}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">✳</span>
          <span>Inkdown</span>
        </div>
        <div className="document-name">
          <FileText size={15} />
          <input
            className="name-input"
            value={nameDraft}
            size={Math.max(nameDraft.length, 8)}
            spellCheck={false}
            aria-label="File name"
            title="Click to rename"
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => void commitName()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setNameDraft(filename);
                e.currentTarget.blur();
              }
            }}
          />

          {dirty && <span className="unsaved" title="Unsaved changes" />}
        </div>
        <div className="top-actions">
          <button onClick={newFile} title="New (Ctrl+N)">
            <FilePlus2 size={16} /> New
          </button>
          <button onClick={() => void openFile()} title="Open (Ctrl+O)">
            <FolderOpen size={16} /> Open
          </button>
          <button className="primary" onClick={() => void saveFile()} title="Save (Ctrl+S)">
            <Save size={16} /> Save
          </button>
        </div>
      </header>
      <div className="toolbar">
        <div className="toolset">
          <Tool
            label="Bold (Ctrl+B)"
            active={!!editor?.isActive('bold')}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold size={17} />
          </Tool>
          <Tool
            label="Italic (Ctrl+I)"
            active={!!editor?.isActive('italic')}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic size={17} />
          </Tool>
          <Tool
            label="Strike"
            active={!!editor?.isActive('strike')}
            onClick={() => editor?.chain().focus().toggleStrike().run()}
          >
            <Strikethrough size={17} />
          </Tool>
          <Tool
            label="Inline code"
            active={!!editor?.isActive('code')}
            onClick={() => editor?.chain().focus().toggleCode().run()}
          >
            <Code2 size={17} />
          </Tool>
        </div>
        <div className="separator" />
        <div className="toolset">
          <Tool
            label="Heading 1"
            active={!!editor?.isActive('heading', { level: 1 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            <Heading1 size={19} />
          </Tool>
          <Tool
            label="Heading 2"
            active={!!editor?.isActive('heading', { level: 2 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 size={19} />
          </Tool>
          <Tool
            label="Bullet list"
            active={!!editor?.isActive('bulletList')}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List size={18} />
          </Tool>
          <Tool
            label="Numbered list"
            active={!!editor?.isActive('orderedList')}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered size={18} />
          </Tool>
          <Tool
            label="Blockquote"
            active={!!editor?.isActive('blockquote')}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          >
            <Quote size={18} />
          </Tool>
          <Tool
            label="Code block"
            active={!!editor?.isActive('codeBlock')}
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          >
            <SquareCode size={18} />
          </Tool>
        </div>
        <div className="separator" />
        <div className="toolset">
          <Tool label="Undo" disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}>
            <Undo2 size={17} />
          </Tool>
          <Tool label="Redo" disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}>
            <Redo2 size={17} />
          </Tool>
        </div>
        <span className="toolbar-spacer" />
        <Tool label="Help" onClick={() => setHelp((v) => !v)}>
          <CircleHelp size={17} />
        </Tool>
      </div>
      <main className="workspace" ref={workspaceRef} onWheel={onWheel}>
        <div className={`book ${spread ? 'spread' : 'stack'}`} style={bookStyle}>
          <div className="sheets" aria-hidden="true">
            {Array.from({ length: pages }, (_, i) => (
              <div key={i} className="sheet" data-n={i + 1} />
            ))}
          </div>
          <div className="editor-shell">
            <EditorContent editor={editor} />
          </div>
        </div>
      </main>
      {help && (
        <div className="help-panel">
          <button className="close" onClick={() => setHelp(false)}>
            ×
          </button>
          <h3>Live Markdown</h3>
          <p>Type complete Markdown markers and the editor turns them into rich formatting.</p>
          <p>
            <code>**bold**</code> · <code>*italic*</code> · <code>`code`</code> · <code>~~strike~~</code>
          </p>
          <p>
            Start a new line with <code># </code>, <code>- </code>, or <code>1. </code> for headings and lists.
          </p>
          <p>
            <strong>Shortcuts:</strong> Ctrl+S save, Ctrl+Shift+S save as, Ctrl+O open, Ctrl+N new.
          </p>
          <p>Open the saved Markdown folder in Git to version-control your notes.</p>
        </div>
      )}
      <footer className="status">
        <span>{notice}</span>
        <span>
          {spread && pages > 2 && (
            <>
              <button
                className="nav"
                title="Previous spread"
                aria-label="Previous spread"
                onClick={() => turnSpread(-1)}
              >
                <ChevronLeft size={13} />
              </button>
              <button className="nav" title="Next spread" aria-label="Next spread" onClick={() => turnSpread(1)}>
                <ChevronRight size={13} />
              </button>
            </>
          )}
          Page {currentPage} of {pages} <span className="dot">·</span> {wordCount} words <span className="dot">·</span>{' '}
          Markdown <span className="dot">·</span> {dirty ? 'Unsaved' : 'Saved'}
        </span>
      </footer>
    </div>
  );
}
