import { describe, expect, it } from 'vitest';
import {
  clockFlipsAt,
  clockPeriodOf,
  DEFAULT_CLOCK_PERIOD,
  isClockPeriod,
  type Component,
} from './component';

const clock = (period?: number): Component => ({
  id: 'c',
  kind: 'CLOCK',
  x: 0,
  y: 0,
  ...(period && { period }),
});

/** 1 tick 目から ticks tick 目までに切り替わる時刻 */
function flips(c: Component, ticks: number): number[] {
  return Array.from({ length: ticks }, (_, i) => i + 1).filter((t) =>
    clockFlipsAt(c, t),
  );
}

describe('CLOCK の周期', () => {
  it('周期がなければ既定の tick 数', () => {
    expect(clockPeriodOf(clock())).toBe(DEFAULT_CLOCK_PERIOD);
    expect(clockPeriodOf(clock(20))).toBe(20);
  });

  it('半周期ごとに切り替わる', () => {
    expect(flips(clock(10), 30)).toEqual([5, 10, 15, 20, 25, 30]);
    expect(flips(clock(4), 8)).toEqual([2, 4, 6, 8]);
  });

  it('周期が奇数でも、一往復は周期の tick 数', () => {
    const f = flips(clock(5), 20);
    // 2 回切り替わる (一往復する) ごとに 5 tick
    expect(f[2] - f[0]).toBe(5);
    expect(f[4] - f[2]).toBe(5);
  });

  it('設定できる周期は範囲内の整数', () => {
    expect(isClockPeriod(10)).toBe(true);
    expect(isClockPeriod(1)).toBe(false);
    expect(isClockPeriod(2.5)).toBe(false);
    expect(isClockPeriod('10')).toBe(false);
  });
});
