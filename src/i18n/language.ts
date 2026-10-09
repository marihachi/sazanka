// 画面に出す言語と、言語ごとに書き分ける文言の型。文言の表は messages.ts、画面への渡し方は useMessages.ts

/** 画面に出す言語 */
export type Language = 'ja' | 'en';

/** 環境設定で選ぶ言語。auto はブラウザの言語に合わせる */
export type LanguageSetting = 'auto' | Language;

/** 環境設定の言語の選択肢の並び */
export const LANGUAGE_SETTINGS: LanguageSetting[] = ['auto', 'ja', 'en'];

/** 環境設定の言語として使える値か */
export function isLanguageSetting(v: unknown): v is LanguageSetting {
  return LANGUAGE_SETTINGS.includes(v as LanguageSetting);
}

/**
 * 環境設定の言語から、画面に出す言語を決める。
 * auto なら、ブラウザでいちばん優先している言語 (browserLanguages の先頭。navigator.languages) が
 * 日本語 (ja、ja-JP など) なら日本語、それ以外 (分からないときも) は英語
 */
export function resolveLanguage(
  setting: LanguageSetting,
  browserLanguages: readonly string[],
): Language {
  if (setting !== 'auto') {
    return setting;
  }
  const first = browserLanguages[0]?.toLowerCase() ?? '';
  return first === 'ja' || first.startsWith('ja-') ? 'ja' : 'en';
}

/** 言語ごとに書き分けた値。言語を足すと、書き分けていない所が型エラーになる */
export type Localized<T> = Record<Language, T>;

/** どの言語でも同じなら文字列 1 つ、言語で変わるなら言語ごとに書き分けた文言 */
export type LocalText = string | Localized<string>;

/** 言語に合わせた文言を取り出す */
export function getLocalText(text: LocalText, lang: Language): string {
  return typeof text === 'string' ? text : text[lang];
}
