/** 元に戻す / やり直しのための履歴 */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

/** 保持する履歴の上限 */
const LIMIT = 100;

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** 履歴に積まずに今の状態を置き換える */
export function replace<T>(h: History<T>, next: T): History<T> {
  return next === h.present ? h : { ...h, present: next };
}

/** 今の状態を履歴に積んでから置き換える。変化がなければ何もしない */
export function commit<T>(h: History<T>, next: T): History<T> {
  if (next === h.present) return h;
  return {
    past: [...h.past, h.present].slice(-LIMIT),
    present: next,
    future: [],
  };
}

/** 今の状態を履歴に積む。この後の replace による変更は、まとめて1回の操作として元に戻せる */
export function checkpoint<T>(h: History<T>): History<T> {
  return {
    past: [...h.past, h.present].slice(-LIMIT),
    present: h.present,
    future: [],
  };
}

/**
 * 1つ前の状態に戻す。
 * merge で、履歴の対象外の値 (スイッチの ON/OFF など) を今の状態から引き継げる。
 */
export function undo<T>(
  h: History<T>,
  merge: (restored: T, current: T) => T = (r) => r,
): History<T> {
  if (h.past.length === 0) return h;
  return {
    past: h.past.slice(0, -1),
    present: merge(h.past[h.past.length - 1], h.present),
    future: [h.present, ...h.future],
  };
}

export function redo<T>(
  h: History<T>,
  merge: (restored: T, current: T) => T = (r) => r,
): History<T> {
  if (h.future.length === 0) return h;
  return {
    past: [...h.past, h.present].slice(-LIMIT),
    present: merge(h.future[0], h.present),
    future: h.future.slice(1),
  };
}
