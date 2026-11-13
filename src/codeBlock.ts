import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';

const lowlight = createLowlight(common);

// A paragraph containing only a fence opener, e.g. ``` or ```typescript or ```c++
export const FENCE_RE = /^```([\w+#.-]*)$/;

/**
 * Code block with syntax highlighting. Markdown only stores the language name after the opening
 * fence; the colours come from highlight.js (via lowlight) at render time. Also accepts Enter after a
 * fence line, which Tiptap's own input rule (space only, letters only) does not.
 */
export const CodeBlock = CodeBlockLowlight.extend({
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || $from.parent.type.name !== 'paragraph') return false;
        const match = FENCE_RE.exec($from.parent.textContent);
        if (!match) return false;
        const start = $from.start();
        return editor
          .chain()
          .deleteRange({ from: start, to: $from.end() })
          .setNode(this.name, { language: match[1] || null })
          .run();
      },
    };
  },
}).configure({ lowlight, defaultLanguage: null });
