import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// Page geometry (px). Sheets use a real paper aspect ratio, scaled down so two fit side by side.
// To switch to A4, use { w: 210, h: 297 }.
export const PAPER = { w: 8.5, h: 11 }; // US Letter, inches
export const PAGE_W = 520;
export const PAGE_H = Math.round((PAGE_W * PAPER.h) / PAPER.w);
export const PAD_X = 48;
export const PAD_Y = 48;
export const PAGE_GAP = 24;
export const CONTENT_H = PAGE_H - PAD_Y * 2;

/**
 * Stacked layout only: pushes top-level blocks that would cross the bottom of a page onto the
 * next one by giving them a larger top margin. Positions are keyed by top-level node offset and
 * are recomputed from measured block heights after every document change.
 */
export const PageBreaks = Extension.create({
  name: 'pageBreaks',
  addStorage() {
    return { breaks: {} as Record<number, number> };
  },
  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin({
        key: new PluginKey('pageBreaks'),
        props: {
          decorations(state) {
            const decos: Decoration[] = [];
            state.doc.forEach((node, offset) => {
              const margin = storage.breaks[offset];
              if (margin)
                decos.push(
                  Decoration.node(offset, offset + node.nodeSize, {
                    class: 'pg-break',
                    style: `margin-top:${margin}px`,
                  }),
                );
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});

/** Distance between the same point on consecutive stacked pages. */
export const PAGE_PERIOD = PAGE_H + PAGE_GAP;

/**
 * Stacked layout: given the heights of the top-level blocks (in order), returns the extra top
 * margin each block that must move to the next page needs (keyed by block index) and the page count.
 * Blocks taller than a page are left in place and run across the page gap.
 */
export function computeStackBreaks(heights: number[]): { breaks: Record<number, number>; pages: number } {
  const breaks: Record<number, number> = {};
  let cum = 0,
    shift = 0;
  heights.forEach((h, i) => {
    const pt = cum + shift;
    const page = Math.floor(pt / PAGE_PERIOD);
    const within = pt - page * PAGE_PERIOD;
    if (within >= CONTENT_H - 0.5 || (within > 0.5 && within + h > CONTENT_H + 0.5 && h <= CONTENT_H)) {
      const push = (page + 1) * PAGE_PERIOD - pt;
      breaks[i] = push;
      shift += push;
    }
    cum += h;
  });
  const end = cum + shift;
  return { breaks, pages: Math.max(2, Math.floor(Math.max(end - 1, 0) / PAGE_PERIOD) + 1) };
}

/** Spread layout: pages needed given the zero-based index of the last used column; always even, at least 2. */
export function spreadPageCount(lastColumnIndex: number): number {
  return Math.max(2, Math.ceil((lastColumnIndex + 1) / 2) * 2);
}
