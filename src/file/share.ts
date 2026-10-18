// 共有用 JSON (プロジェクトファイル) の書き出しと読み込み。形の検証は project.ts の checkProject を使う

import {
  type Project,
  type ProjectError,
  checkProject,
  withoutSwitchStates,
} from '../circuit/project';
import { fromStoredProject, type StoredProject, toStoredProject } from './storage';
import { upgradeStoredProject } from './upgrade';

/** プロジェクト全体を共有用の JSON (プロジェクトの形式のデータ) にする */
export function serializeProject(project: Project): string {
  return JSON.stringify(toStoredProject(withoutSwitchStates(project)));
}

/**
 * 共有用 JSON を読み込めなかった理由。BROKEN の detail は、検証で見つかった問題。
 * MODULE_FILE は、モジュールのデータかモジュールファイルを選んだ (プロジェクトの読み込みでは読めない)
 */
export type ShareError =
  | { code: 'NOT_JSON' }
  | { code: 'NOT_SAZANKA' }
  | { code: 'NEWER_VERSION' }
  | { code: 'MODULE_FILE' }
  | { code: 'BROKEN'; detail: ProjectError };

export type ParseResult = { ok: true; project: Project } | { ok: false; error: ShareError };

/**
 * 共有用の JSON を読み込む。回路の ID は付け直さない。
 * 一体の形式 (version 1〜4) で書き出したものも、読み込みの入口 (upgrade/index.ts) で新しい形式にしてから読む。
 * newId は、部品と配線の ID (保存しない) を付けるのと、古い版の ID を付け直す変換 (upgradeV3) に使う。
 * 他人から受け取った文字列なので、形が正しいかをひととおり確かめ、問題があれば理由を返す
 */
export function parseProject(text: string, newId: () => string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: { code: 'NOT_JSON' } };
  }
  const upgraded = upgradeStoredProject(data, newId);
  if (!upgraded.ok) {
    const { code } = upgraded.error;
    return { ok: false, error: { code: code === 'NOT_PROJECT' ? 'NOT_SAZANKA' : code } };
  }
  const error = checkProject(upgraded.project);
  if (error) {
    return { ok: false, error: { code: 'BROKEN', detail: error } };
  }
  // 古いデータには ON/OFF が入っていることがあるが、使わない
  return {
    ok: true,
    project: withoutSwitchStates(fromStoredProject(upgraded.project as StoredProject, newId)),
  };
}
