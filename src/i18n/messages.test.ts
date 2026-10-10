import { describe, expect, it } from 'vitest';
import { PART_VIEWS } from '../parts/views';
import { ACCENT_PRESETS } from '../preferences/preferences';
import { describeShareError, getCircuitName, getMessages, MESSAGES } from './messages';

const JAPANESE = /[぀-ヿ一-鿿]/;

/** 表の中の文字列をすべて集める (関数の文言は含まない) */
function collectStrings(value: unknown, path: string, out: [string, string][]) {
  if (typeof value === 'string') {
    out.push([path, value]);
  } else if (Array.isArray(value)) {
    for (const [i, v] of value.entries()) {
      collectStrings(v, `${path}[${i}]`, out);
    }
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      collectStrings(v, `${path}.${k}`, out);
    }
  }
}

describe('英語の文言', () => {
  it('表に日本語が混ざっていない (言語の選択肢の「日本語」と、欄の名前に添えた「言語」を除く)', () => {
    const strings: [string, string][] = [];
    collectStrings(MESSAGES.en, 'en', strings);
    const allowed = new Set(['en.preferences.language', 'en.preferences.languages.ja']);
    const mixed = strings.filter(([path, s]) => !allowed.has(path) && JAPANESE.test(s));
    expect(mixed).toEqual([]);
  });

  it('部品の種類とアクセントカラーの文言に日本語が混ざっていない', () => {
    for (const view of Object.values(PART_VIEWS)) {
      expect(view.description.en).not.toMatch(JAPANESE);
      const hints = view.hints?.en;
      const lines = typeof hints === 'function' ? hints({ period: 100, periodSeconds: 1 }) : hints;
      for (const line of lines ?? []) {
        expect(line).not.toMatch(JAPANESE);
      }
    }
    for (const preset of ACCENT_PRESETS) {
      expect(preset.label.en).not.toMatch(JAPANESE);
    }
  });
});

describe('describeShareError', () => {
  it('壊れたデータでは、検証で見つかった問題を添える', () => {
    const error = {
      code: 'BROKEN',
      detail: { code: 'DUPLICATE_PART_ID', circuit: 'Main', id: 'a' },
    } as const;
    expect(describeShareError(getMessages('en'), error)).toBe(
      'The circuit data is broken ("Main" has a duplicate part ID: a)',
    );
    expect(describeShareError(getMessages('ja'), error)).toBe(
      '回路データが壊れています (「Main」で部品の ID が重複しています: a)',
    );
  });
});

describe('getCircuitName', () => {
  it('メイン回路は保存した名前によらず表示言語の名前、モジュールは付けた名前', () => {
    expect(getCircuitName({ id: 'main', name: 'メイン' }, getMessages('en'))).toBe('Main');
    expect(getCircuitName({ id: 'main', name: 'メイン' }, getMessages('ja'))).toBe('メイン');
    expect(getCircuitName({ id: 'm1', name: 'モジュール1' }, getMessages('en'))).toBe(
      'モジュール1',
    );
  });
});
