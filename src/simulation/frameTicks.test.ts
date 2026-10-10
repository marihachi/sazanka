import { describe, expect, it } from 'vitest';
import { frameTicks, MAX_FRAME_ELAPSED_MS } from './frameTicks';

describe('frameTicks', () => {
  it('経過時間ぶんの tick を進め、端数は次のフレームへ持ち越す', () => {
    expect(frameTicks(0, 25, 100)).toEqual({ count: 2, carry: 0.5 });
  });

  it('1 tick に満たなければ進めず、そのまま持ち越す', () => {
    expect(frameTicks(0, 7, 100)).toEqual({ count: 0, carry: 0.7 });
  });

  it('持ち越した端数は、次のフレームの経過時間と合わせて数える', () => {
    const first = frameTicks(0, 16, 100);
    expect(first.count).toBe(1);
    expect(first.carry).toBeCloseTo(0.6);
    const second = frameTicks(first.carry, 16, 100);
    expect(second.count).toBe(2);
    expect(second.carry).toBeCloseTo(0.2);
  });

  it('1 秒の tick 数が多ければ、1 フレームで多くの tick を進める', () => {
    expect(frameTicks(0, 16, 100_000)).toEqual({ count: 1600, carry: 0 });
  });

  it('1 秒の tick 数が少なければ、何フレームもかけて 1 tick 進める', () => {
    let carry = 0;
    const counts: number[] = [];
    for (let i = 0; i < 9; i++) {
      const r = frameTicks(carry, 125, 1);
      counts.push(r.count);
      carry = r.carry;
    }
    expect(counts).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 0]);
  });

  it('経過時間は上限までしか数えず、タブを離れていた間の tick を一度に進めない', () => {
    // タブを 1 分離れていたときなど
    expect(frameTicks(0, 60_000, 100)).toEqual({
      count: (MAX_FRAME_ELAPSED_MS * 100) / 1000,
      carry: 0,
    });
  });
});
