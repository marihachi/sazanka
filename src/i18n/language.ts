// 画面に出す言語と、言語ごとに書き分ける文言の型。文言の表は messages.ts、画面への渡し方は useMessages.ts

/** 画面に出す言語 */
export type Language = 'ja';

/** 言語ごとに書き分けた値。言語を足すと、書き分けていない所が型エラーになる */
export type Localized<T> = Record<Language, T>;

/** どの言語でも同じなら文字列 1 つ、言語で変わるなら言語ごとに書き分けた文言 */
export type LocalText = string | Localized<string>;

/** 言語に合わせた文言を取り出す */
export function getLocalText(text: LocalText, lang: Language): string {
  return typeof text === 'string' ? text : text[lang];
}
