// プロジェクトファイルの書き出しと読み込み。形の検証は project.ts の checkProject を使う

import {
  type Project,
  type ProjectError,
  checkProject,
  withoutSwitchStates,
} from '../circuit/project';
import { hashString } from '../util';
import { fromStoredProject, type StoredProject, toStoredProject } from './storage';
import { upgradeStoredProject } from './upgrade';

/** プロジェクト全体をプロジェクトファイル (プロジェクトの形式のデータ) にする */
export function serializeProject(project: Project): string {
  return JSON.stringify(toStoredProject(withoutSwitchStates(project)));
}

/**
 * プロジェクトの指紋。プロジェクトファイルに書く中身 (serializeProject) から作るので、ファイルに書かないもの
 * (INPUT の ON/OFF、部品と配線の ID) が違っても同じになる。ファイルに保存したときから変わったかを見るのに使う
 */
export function projectHash(project: Project): string {
  return hashString(serializeProject(project));
}

/**
 * プロジェクトファイルを読み込めなかった理由。BROKEN の detail は、検証で見つかった問題。
 * CIRCUIT_FILE は、回路のデータか回路ファイルを選んだ (プロジェクトの読み込みでは読めない)
 */
export type ProjectFileError =
  | { code: 'NOT_JSON' }
  | { code: 'NOT_SAZANKA' }
  | { code: 'NEWER_VERSION' }
  | { code: 'CIRCUIT_FILE' }
  | { code: 'BROKEN'; detail: ProjectError };

export type ParseResult = { ok: true; project: Project } | { ok: false; error: ProjectFileError };

/**
 * プロジェクトファイルを読み込む。回路の ID は付け直さない。
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
