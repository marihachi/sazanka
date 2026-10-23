// 保存データとプロジェクトファイルの読み込みの入口。一体の形式 (version 1〜4) か新しい形式 (プロジェクトの形式) かを見分けて、
// 今の版のプロジェクトの形式の形にする。保存データ (storage.ts) とプロジェクトファイル (projectFile.ts) の両方で使う。
// 一体の形式は、1 版分の変換 (integrated/upgradeV<N>: version N → N+1) を順に通して version 4 にしてから、
// プロジェクトの形式 v1 に変える (project/v1.ts)。形の検証は、このあとに今の版の形で行う (circuit/project.ts の checkProject)。
// 各変換は今のアプリのコードに頼らない (決まりは agent/docs/persistence.md の「形式を変えるとき」)

import { isObject } from '../../util';
import { upgradeV1 } from './integrated/upgradeV1';
import { upgradeV2 } from './integrated/upgradeV2';
import { upgradeV3 } from './integrated/upgradeV3';
import { upgradeToProjectV1 } from './project/v1';

/** プロジェクトの形式の今の版。形式を変えたら上げて、1 版分の変換 (project/v<N>.ts) を足す */
export const PROJECT_FORMAT_VERSION = 1;

/** 回路の形式の今の版。形式を変えたら上げて、1 版分の変換 (circuit/v<N>.ts) を足す */
export const CIRCUIT_FORMAT_VERSION = 1;

/** 回路ファイルの形式の今の版。プロジェクトと回路の形式とは別に数える (中の回路は回路の形式で、その版は CIRCUIT_FORMAT_VERSION) */
export const CIRCUITS_FILE_FORMAT_VERSION = 1;

/**
 * 一体の形式の 1 版分の変換を、版の順に並べたもの。INTEGRATED_UPGRADES[i] は version i + 1 のプロジェクトを version i + 2 の形にする。
 * newId は、ID を付け直す変換 (upgradeV3) が新しい ID を作るのに使う。一体の形式は version 4 で終わりなので、もう足さない
 */
const INTEGRATED_UPGRADES: ((project: unknown, newId: () => string) => unknown)[] = [
  upgradeV1,
  upgradeV2,
  upgradeV3,
];

/** 一体の形式の最後の版 */
const INTEGRATED_LAST_VERSION = INTEGRATED_UPGRADES.length + 1;

/**
 * 一体の形式の version の版のプロジェクト (外側の包みの中の project) を、一体の形式の最後の版 (version 4) の形にする。
 * version 4 なら、そのまま返す。新しい ID は newId で作る
 */
export function upgradeIntegratedProject(
  project: unknown,
  version: number,
  newId: () => string,
): unknown {
  // 1 より小さい版や、整数でない版は、version 1 から変える (version 1 より前の形はない)
  let upgraded = project;
  for (let v = Math.max(1, Math.floor(version)); v <= INTEGRATED_UPGRADES.length; v++) {
    upgraded = INTEGRATED_UPGRADES[v - 1](upgraded, newId);
  }
  return upgraded;
}

/**
 * 読み込んだデータを、今の版のプロジェクトの形式にできなかった理由。
 * NOT_PROJECT は sazanka のプロジェクトのデータでない、NEWER_VERSION は今より新しい版のデータ、
 * CIRCUIT_FILE は回路のデータか回路ファイル (プロジェクトの読み込みで選ぶものではない)
 */
export type UpgradeError =
  | { code: 'NOT_PROJECT' }
  | { code: 'NEWER_VERSION' }
  | { code: 'CIRCUIT_FILE' };

export type UpgradeResult = { ok: true; project: unknown } | { ok: false; error: UpgradeError };

/**
 * 保存データかプロジェクトファイル (JSON を読んだもの) を、今の版のプロジェクトの形式の形にする。
 * 新しい形式は format で、一体の形式は format がなく、いちばん外に version と project を持つことで見分ける。
 * 版の番号だけでは見分けない (一体の形式の version 1 とプロジェクトの形式の version 1 があるため)。
 * 形が正しいかは確かめない (このあとに checkProject で確かめる)
 */
export function upgradeStoredProject(data: unknown, newId: () => string): UpgradeResult {
  if (!isObject(data)) {
    return { ok: false, error: { code: 'NOT_PROJECT' } };
  }
  if (data.format === 'sazanka-circuit' || data.format === 'sazanka-circuits') {
    return { ok: false, error: { code: 'CIRCUIT_FILE' } };
  }
  if (data.format === 'sazanka-project') {
    return isNewer(data)
      ? { ok: false, error: { code: 'NEWER_VERSION' } }
      : { ok: true, project: data };
  }
  if (data.format !== undefined || typeof data.version !== 'number' || !('project' in data)) {
    return { ok: false, error: { code: 'NOT_PROJECT' } };
  }
  if (data.version > INTEGRATED_LAST_VERSION) {
    return { ok: false, error: { code: 'NEWER_VERSION' } };
  }
  const integrated = upgradeIntegratedProject(data.project, data.version, newId);
  return { ok: true, project: upgradeToProjectV1(integrated) };
}

/**
 * プロジェクトの形式のデータか、その中の回路に、今より新しい版のものがあるか。
 * 版が数でないものは新しいとはみなさない (検証で断る)
 */
function isNewer(data: Record<string, unknown>): boolean {
  if (typeof data.version === 'number' && data.version > PROJECT_FORMAT_VERSION) {
    return true;
  }
  if (!Array.isArray(data.circuits)) {
    return false;
  }
  return data.circuits.some(
    (entry) =>
      isObject(entry) &&
      isObject(entry.circuit) &&
      typeof entry.circuit.version === 'number' &&
      entry.circuit.version > CIRCUIT_FORMAT_VERSION,
  );
}
