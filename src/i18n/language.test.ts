import { describe, expect, it } from 'vitest';
import { isLanguageSetting, resolveLanguage } from './language';

describe('resolveLanguage', () => {
  it('言語を選んでいれば、ブラウザの言語によらずその言語', () => {
    expect(resolveLanguage('ja', ['en-US'])).toBe('ja');
    expect(resolveLanguage('en', ['ja'])).toBe('en');
  });

  it('自動では、ブラウザでいちばん優先している言語が日本語なら日本語', () => {
    expect(resolveLanguage('auto', ['ja'])).toBe('ja');
    expect(resolveLanguage('auto', ['ja-JP', 'en'])).toBe('ja');
    expect(resolveLanguage('auto', ['JA-jp'])).toBe('ja');
  });

  it('自動では、日本語以外と分からないときは英語', () => {
    expect(resolveLanguage('auto', ['en-US', 'ja'])).toBe('en');
    expect(resolveLanguage('auto', ['fr'])).toBe('en');
    expect(resolveLanguage('auto', ['jav'])).toBe('en');
    expect(resolveLanguage('auto', [])).toBe('en');
  });
});

describe('isLanguageSetting', () => {
  it('選択肢の値だけを認める', () => {
    for (const v of ['auto', 'ja', 'en']) {
      expect(isLanguageSetting(v)).toBe(true);
    }
    for (const v of ['fr', 'JA', '', null, undefined, 1]) {
      expect(isLanguageSetting(v)).toBe(false);
    }
  });
});
