import { describe, expect, it } from 'vitest';
import {
  ACCENT_PRESETS,
  DEFAULT_PREFERENCES,
  isAccent,
  isTicksPerSecond,
  MAX_TICKS_PER_SECOND,
  MIN_TICKS_PER_SECOND,
} from './preferences';

describe('isTicksPerSecond', () => {
  it('範囲内の整数だけを 1 秒の tick 数として認める', () => {
    expect(isTicksPerSecond(MIN_TICKS_PER_SECOND)).toBe(true);
    expect(isTicksPerSecond(MAX_TICKS_PER_SECOND)).toBe(true);
    expect(isTicksPerSecond(DEFAULT_PREFERENCES.ticksPerSecond)).toBe(true);
  });

  it('範囲の外、整数でない値、数でない値は認めない', () => {
    // biome-ignore format: 表形式を維持するため
    const values = [
      MIN_TICKS_PER_SECOND - 1, MAX_TICKS_PER_SECOND + 1, 1.5, Number.NaN, Infinity, '10', null,
    ];
    for (const v of values) {
      expect(isTicksPerSecond(v)).toBe(false);
    }
  });
});

describe('isAccent', () => {
  it('#rrggbb の形の色を認める (大文字も)', () => {
    expect(isAccent('#20b2aa')).toBe(true);
    expect(isAccent('#20B2AA')).toBe(true);
  });

  it('ほかの書き方の色や、色でない値は認めない', () => {
    for (const v of ['#fff', '20b2aa', '#20b2aa0', 'teal', '#gggggg', 0x20b2aa, undefined]) {
      expect(isAccent(v)).toBe(false);
    }
  });

  it('既定値と、選べる色はどれもアクセントカラーとして使える', () => {
    expect(isAccent(DEFAULT_PREFERENCES.accent)).toBe(true);
    expect(ACCENT_PRESETS.every((p) => isAccent(p.value))).toBe(true);
    expect(ACCENT_PRESETS[0].value).toBe(DEFAULT_PREFERENCES.accent);
  });
});
