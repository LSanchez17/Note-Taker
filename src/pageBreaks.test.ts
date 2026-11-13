import { describe, expect, it } from 'vitest';
import { CONTENT_H, PAGE_H, PAGE_W, PAPER, PAGE_PERIOD, computeStackBreaks, spreadPageCount } from './pageBreaks';

describe('computeStackBreaks', () => {
  it('always reports at least two pages', () => {
    expect(computeStackBreaks([]).pages).toBe(2);
    expect(computeStackBreaks([100]).pages).toBe(2);
  });

  it('keeps blocks on the first page when they fit', () => {
    const r = computeStackBreaks([100, 100, 100]);
    expect(r.breaks).toEqual({});
  });

  it('moves a block that would cross the page bottom to the next page', () => {
    const r = computeStackBreaks([CONTENT_H - 50, 100]);
    // Second block starts at the top of page two.
    expect(r.breaks[1]).toBe(PAGE_PERIOD - (CONTENT_H - 50));
  });

  it('moves the next block when the previous one exactly fills the page', () => {
    const r = computeStackBreaks([CONTENT_H, 40]);
    expect(r.breaks[1]).toBe(PAGE_PERIOD - CONTENT_H);
  });

  it('adds a third page once content overflows two', () => {
    const r = computeStackBreaks([CONTENT_H, CONTENT_H, 40]);
    expect(r.pages).toBe(3);
  });

  it('leaves blocks taller than a page in place', () => {
    const r = computeStackBreaks([100, CONTENT_H + 200]);
    expect(r.breaks).toEqual({});
  });

  it('pushes the block after an oversized one onto a fresh page', () => {
    const r = computeStackBreaks([CONTENT_H + 20, 40]); // ends inside the gap between pages
    expect(r.breaks[1]).toBe(PAGE_PERIOD - (CONTENT_H + 20));
    expect(r.pages).toBe(2);
  });
});

describe('page size', () => {
  it('matches the paper aspect ratio', () => {
    expect(PAGE_H / PAGE_W).toBeCloseTo(PAPER.h / PAPER.w, 2);
  });
});

describe('spreadPageCount', () => {
  it('starts at two pages and grows in pairs', () => {
    expect(spreadPageCount(0)).toBe(2);
    expect(spreadPageCount(1)).toBe(2);
    expect(spreadPageCount(2)).toBe(4);
    expect(spreadPageCount(3)).toBe(4);
    expect(spreadPageCount(4)).toBe(6);
  });
});
