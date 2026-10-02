import { describe, expect, it } from 'vitest';
import {
  ACCENT_PRESETS,
  DEFAULT_PREFERENCES,
  isAccent,
  isTickMs,
  MAX_TICK_MS,
  MIN_TICK_MS,
} from './preferences';

describe('isTickMs', () => {
  it('範囲内の整数だけを間隔として認める', () => {
    expect(isTickMs(MIN_TICK_MS)).toBe(true);
    expect(isTickMs(MAX_TICK_MS)).toBe(true);
    expect(isTickMs(DEFAULT_PREFERENCES.tickMs)).toBe(true);
  });

  it('範囲の外、整数でない値、数でない値は認めない', () => {
    for (const v of [MIN_TICK_MS - 1, MAX_TICK_MS + 1, 1.5, Number.NaN, Infinity, '10', null]) {
      expect(isTickMs(v)).toBe(false);
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
