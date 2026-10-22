import { describe, expect, it } from 'vitest';
import type { Part } from '../circuit/part';
import { statusHints, type HintContext } from './hints';

const base: HintContext = {
  dragMode: 'none',
  wireTool: false,
  splitTool: false,
  wiring: false,
  placing: false,
  editing: false,
  wireSelected: false,
  multipleSelected: false,
  unstable: false,
  conflict: false,
  inMain: false,
  numberedPackage: false,
  unexposedPorts: false,
  ticksPerSecond: 100,
};

function hints(ctx: Partial<HintContext>): string[] {
  return statusHints({ ...base, ...ctx }, 'ja');
}

function comp(kind: Part['kind']): Part {
  return { id: 'x', kind, x: 0, y: 0 };
}

describe('statusHints', () => {
  it('操作の途中は、そのとき必要な1文だけを出す', () => {
    // biome-ignore format: 表形式を維持するため
    for (const ctx of [
      { dragMode: 'trash' as const },
      { dragMode: 'moving' as const },
      { dragMode: 'wireEnd' as const },
      { wiring: true },
      { wireTool: true },
      { splitTool: true },
      { editing: true },
      { wireSelected: true },
    ]) {
      expect(hints(ctx)).toHaveLength(1);
    }
  });

  it('配線の端のドラッグ中は、選んでいる配線の説明ではなく、端のドラッグの説明を出す', () => {
    expect(hints({ dragMode: 'wireEnd', wireSelected: true })).toEqual([
      '配線の端をドラッグして長さを変更 ・ 離すと確定',
    ]);
  });

  it('配線中は、配線モードの説明より配線中の説明を出す', () => {
    expect(hints({ wireTool: true, wiring: true })).toEqual(hints({ wiring: true }));
  });

  it('出力ピンがぶつかっていて何も選んでいなければ、そのことを出す', () => {
    expect(hints({ conflict: true })).toHaveLength(1);
    expect(hints({ conflict: true })).not.toEqual(hints({}));
  });

  it('操作の途中は、部品を選んでいてもそちらを優先する', () => {
    expect(hints({ wiring: true, selectedPart: comp('input') })).toEqual(hints({ wiring: true }));
  });

  it('部品を選ぶと、その部品の説明と、移動・削除の方法を出す', () => {
    for (const kind of [
      'input',
      'output',
      'clock',
      'high',
      'module',
      'rsLatch',
      'rsEnLatch',
      'dLatch',
      'dFlipFlop',
      'tFlipFlop',
      'jkFlipFlop',
      'and',
    ] as const) {
      const result = hints({ selectedPart: comp(kind) });
      expect(result).toContain('ドラッグで移動');
      expect(result.length).toBeGreaterThan(1);
    }
  });

  it('発振しているときは、選択がなければ警告の説明を出す', () => {
    expect(hints({ unstable: true })).toHaveLength(1);
    expect(hints({ unstable: true })[0]).toContain('発振');
  });

  it('何もしていないときは、使い方のヒントを順に出す。回路のヒントを先に出す', () => {
    const main = hints({ inMain: true });
    const module = hints({});
    expect(main.length).toBeGreaterThan(1);
    // モジュールのタブでは、モジュールだけのヒントの分、多い
    expect(module.length).toBeGreaterThan(main.length);
    // どちらも、使い方のヒントで終わる
    const idle = main.slice(1);
    expect(module.slice(-idle.length)).toEqual(idle);
  });

  it('メイン回路では、回路設定のヒントを出し、タブの操作と split の並び順のヒントは出さない', () => {
    const main = hints({ inMain: true });
    expect(main[0]).toContain('回路設定');
    expect(main.some((h) => h.includes('タブをダブルクリック'))).toBe(false);
    expect(main.some((h) => h.includes('シミュレーションは止まる'))).toBe(false);
    expect(main.some((h) => h.includes('ポート番号の順に並ぶ'))).toBe(false);
    expect(main.some((h) => h.includes('ピンが増える'))).toBe(false);
    // dip / qfp なら、空いているピンに割り当てられることは出す
    const numbered = hints({ inMain: true, numberedPackage: true });
    expect(numbered.some((h) => h.includes('空いているピンに自動で割り当てられる'))).toBe(true);
  });

  it('外側のピンに出せないポートを選ぶと、その理由を先頭に出す', () => {
    const result = hints({ selectedPart: comp('input'), selectedPortProblem: 'duplicate' });
    expect(result[0]).toContain('同じピン番号');
    expect(result).toContain('ドラッグで移動');
  });

  it('外側のピンに出せないポートがあって何も選んでいなければ、そのことを出す', () => {
    expect(hints({ unexposedPorts: true })).toHaveLength(1);
    expect(hints({ unexposedPorts: true })[0]).toContain('ピンに割り当てられていない');
  });

  it('モジュールのヒントは、ピンの決め方 (split か、ピン番号か) で変える', () => {
    const split = hints({});
    const numbered = hints({ numberedPackage: true });
    expect(split.some((h) => h.includes('ポート番号の順に並ぶ'))).toBe(true);
    expect(numbered.some((h) => h.includes('ポート番号の順に並ぶ'))).toBe(false);
    expect(numbered.some((h) => h.includes('空いているピンに自動で割り当てられる'))).toBe(true);
  });

  it('見つからないモジュールを選ぶと、開けないことと、ピンがないことを出す (モジュールのヒントは出さない)', () => {
    const result = hints({ selectedPart: comp('module'), selectedUnresolved: true });
    expect(result[0]).toContain('プロジェクトにない');
    expect(result.some((h) => h.includes('ダブルクリックでモジュールの回路を開く'))).toBe(false);
  });
});
