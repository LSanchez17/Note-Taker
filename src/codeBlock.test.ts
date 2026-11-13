// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { CodeBlock, FENCE_RE } from './codeBlock';

const makeEditor = (content: string | object = '') =>
  new Editor({
    extensions: [StarterKit.configure({ codeBlock: false }), CodeBlock, Markdown],
    content,
    ...(typeof content === 'string' ? { contentType: 'markdown' as const } : {}),
  });

describe('FENCE_RE', () => {
  it.each(['```', '```typescript', '```c++', '```c#', '```python3'])('matches %s', (s) => {
    expect(FENCE_RE.test(s)).toBe(true);
  });
  it.each(['``', '``` ts', 'text ```', '```ts code'])('rejects %s', (s) => {
    expect(FENCE_RE.test(s)).toBe(false);
  });
});

describe('code blocks', () => {
  it('parses a fenced block with its language and writes it back', () => {
    const md = '```typescript\nconst x = 1;\n```';
    const editor = makeEditor(md);
    const node = editor.state.doc.firstChild!;
    expect(node.type.name).toBe('codeBlock');
    expect(node.attrs.language).toBe('typescript');
    expect(editor.getMarkdown().trim()).toBe(md);
    editor.destroy();
  });

  it('turns a typed fence line into a code block on Enter', () => {
    const editor = makeEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '```typescript' }] }],
    });
    editor.commands.focus('end');
    // Run the Enter shortcut directly (jsdom has no real keyboard handling).
    const enter = (
      editor.extensionManager.extensions.find((e) => e.name === 'codeBlock')!.config as any
    ).addKeyboardShortcuts.call({ name: 'codeBlock', parent: undefined, editor }).Enter;
    expect(enter({ editor })).toBe(true);
    const node = editor.state.doc.firstChild!;
    expect(node.type.name).toBe('codeBlock');
    expect(node.attrs.language).toBe('typescript');
    expect(node.textContent).toBe('');
    editor.destroy();
  });
});
