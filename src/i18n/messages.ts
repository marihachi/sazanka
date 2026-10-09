// 言語ごとの文言の表の一覧と、その形。表の中身は言語ごとのファイル (ja.ts) に置く。
// 計算の側が返すエラーを、表の文にする処理もここに置く (言語によらない)
import { type CircuitDef, MAIN_ID, type ProjectError } from '../circuit/project';
import type { ShareError } from '../file/share';
import type { StoredError } from '../file/storage';
import { en } from './en';
import { ja } from './ja';
import type { Language, Localized } from './language';

/** 文言の表の形。日本語の表を元にする */
export type Messages = typeof ja;

export const MESSAGES: Localized<Messages> = { ja, en };

/** 言語の文言の表 */
export function getMessages(lang: Language): Messages {
  return MESSAGES[lang];
}

/** エラーの種類 (code) ごとの文。文字列か、そのエラーを受け取って文を返す関数 */
export type ErrorTexts<E extends { code: string }> = {
  [K in E['code']]: string | ((e: Extract<E, { code: K }>) => string);
};

/** エラーを、種類ごとの文の表から文にする */
function describeError<E extends { code: string }>(texts: ErrorTexts<E>, e: E): string {
  // 種類ごとの関数は、その種類のエラーだけを受け取る。e.code で引いたので、e はその種類のエラーになっている
  const text = texts[e.code as E['code']] as string | ((e: E) => string);
  return typeof text === 'string' ? text : text(e);
}

/** 検証で見つかった、プロジェクトの形の問題を文にする */
function describeProjectError(m: Messages, e: ProjectError): string {
  return describeError(m.errors.project, e);
}

/** 共有用 JSON を読み込めなかった理由を文にする。壊れていたときは、検証で見つかった問題も添える */
export function describeShareError(m: Messages, e: ShareError): string {
  if (e.code === 'BROKEN') {
    return m.errors.share.BROKEN(describeProjectError(m, e.detail));
  }
  return describeError(m.errors.share, e);
}

/** 保存データを読み込めなかった理由を文にする */
export function describeStoredError(m: Messages, e: StoredError): string {
  return describeError(m.errors.stored, e);
}

/**
 * 画面に出す回路の名前。メイン回路は、保存した名前 (作ったときの「メイン」) ではなく、表示言語の名前にする。
 * モジュールは、利用者が付けた名前のまま
 */
export function getCircuitName(def: Pick<CircuitDef, 'id' | 'name'>, m: Messages): string {
  return def.id === MAIN_ID ? m.common.mainCircuit : def.name;
}
