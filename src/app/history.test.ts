import { describe, expect, it } from 'vitest';
import {
  checkpoint,
  commit,
  initHistory,
  redo,
  replace,
  undo,
} from './history';

describe('history', () => {
  it('commit した状態を undo / redo で行き来できる', () => {
    let h = initHistory('a');
    h = commit(h, 'b');
    h = commit(h, 'c');
    h = undo(h);
    expect(h.present).toBe('b');
    h = undo(h);
    expect(h.present).toBe('a');
    h = undo(h); // これ以上戻れない
    expect(h.present).toBe('a');
    h = redo(h);
    h = redo(h);
    expect(h.present).toBe('c');
    h = redo(h); // これ以上進めない
    expect(h.present).toBe('c');
  });

  it('新しく commit すると、やり直し用の履歴は消える', () => {
    let h = commit(commit(initHistory('a'), 'b'), 'c');
    h = undo(h);
    h = commit(h, 'x');
    expect(h.future).toEqual([]);
    expect(undo(h).present).toBe('b');
  });

  it('変化のない commit は履歴に積まない', () => {
    const h = initHistory('a');
    expect(commit(h, 'a')).toBe(h);
  });

  it('replace は履歴に積まない', () => {
    let h = commit(initHistory('a'), 'b');
    h = replace(h, 'b2');
    expect(undo(h).present).toBe('a');
  });

  it('checkpoint 以降の replace は1回の操作として戻せる (ドラッグ)', () => {
    let h = initHistory('x=0');
    h = checkpoint(h);
    for (const s of ['x=1', 'x=2', 'x=3']) {
      h = replace(h, s);
    }
    h = undo(h);
    expect(h.present).toBe('x=0');
    expect(redo(h).present).toBe('x=3');
  });

  it('merge で今の状態の一部を引き継げる', () => {
    let h = commit(initHistory({ shape: 'a', on: false }), {
      shape: 'b',
      on: false,
    });
    h = replace(h, { ...h.present, on: true }); // スイッチ操作は履歴に積まない
    h = undo(h, (restored, current) => ({ ...restored, on: current.on }));
    expect(h.present).toEqual({ shape: 'a', on: true });
  });

  it('redo でも merge で今の状態の一部を引き継げる', () => {
    let h = commit(initHistory({ shape: 'a', on: false }), {
      shape: 'b',
      on: false,
    });
    h = undo(h);
    h = replace(h, { ...h.present, on: true });
    h = redo(h, (restored, current) => ({ ...restored, on: current.on }));
    expect(h.present).toEqual({ shape: 'b', on: true });
  });

  it('履歴は上限を超えると古いものから捨てる', () => {
    let h = initHistory(0);
    for (let i = 1; i <= 150; i++) {
      h = commit(h, i);
    }
    expect(h.past.length).toBe(100);
    expect(h.past[0]).toBe(50);
  });
});
