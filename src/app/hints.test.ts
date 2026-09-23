import { describe, expect, it } from 'vitest';
import type { Component } from '../engine/component';
import { statusHints, type HintContext } from './hints';

const base: HintContext = {
  dragMode: 'none',
  wiring: false,
  placing: false,
  editing: false,
  wireSelected: false,
  multipleSelected: false,
  unstable: false,
  inModule: false,
  tickMs: 10,
};

function hints(ctx: Partial<HintContext>): string[] {
  return statusHints({ ...base, ...ctx });
}

function comp(kind: Component['kind']): Component {
  return { id: 'x', kind, x: 0, y: 0 };
}

describe('statusHints', () => {
  it('操作の途中は、そのとき必要な1文だけを出す', () => {
    for (const ctx of [
      { dragMode: 'trash' as const },
      { dragMode: 'moving' as const },
      { wiring: true },
      { editing: true },
      { wireSelected: true },
    ]) {
      expect(hints(ctx)).toHaveLength(1);
    }
  });

  it('操作の途中は、部品を選んでいてもそちらを優先する', () => {
    expect(hints({ wiring: true, selectedComponent: comp('INPUT') })).toEqual(
      hints({ wiring: true }),
    );
  });

  it('部品を選ぶと、その部品の説明と、移動・削除の方法を出す', () => {
    for (const kind of [
      'INPUT',
      'OUTPUT',
      'CLOCK',
      'HIGH',
      'CUSTOM',
      'RS',
      'RSEN',
      'DLATCH',
      'DFF',
      'TFF',
      'JKFF',
      'AND',
    ] as const) {
      const result = hints({ selectedComponent: comp(kind) });
      expect(result).toContain('ドラッグで移動');
      expect(result.length).toBeGreaterThan(1);
    }
  });

  it('発振しているときは、選択がなければ警告の説明を出す', () => {
    expect(hints({ unstable: true })).toHaveLength(1);
    expect(hints({ unstable: true })[0]).toContain('発振');
  });

  it('何もしていないときは、使い方のヒントを順に出す', () => {
    const idle = hints({});
    expect(idle.length).toBeGreaterThan(1);
    // モジュールのタブでは、モジュール向けのヒントを先に出す
    const inModule = hints({ inModule: true });
    expect(inModule.length).toBeGreaterThan(idle.length);
    expect(inModule.slice(-idle.length)).toEqual(idle);
  });
});
