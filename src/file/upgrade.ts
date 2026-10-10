// 古い版のプロジェクトを、今の版の形に順に変える入口。保存データ (storage.ts) と共有用 JSON (share.ts) の両方で使う。
// 版を上げるときは、1 版分の変換 (upgradeV<N>: version N → N+1) を作って UPGRADES の末尾に足す。
// 各変換は今のアプリのコードに頼らない (決まりは agent/docs/persistence.md の「形式を変えるとき」)

import { upgradeV1 } from './upgradeV1';
import { upgradeV2 } from './upgradeV2';

/** 1 版分の変換を、版の順に並べたもの。UPGRADES[i] は version i + 1 のプロジェクトを version i + 2 の形にする */
const UPGRADES: ((project: unknown) => unknown)[] = [upgradeV1, upgradeV2];

/**
 * version の版のプロジェクトを、今の版の形にする。今の版なら、そのまま返す。
 * 形の検証は、このあとに今の版の形で行う (project.ts の checkProject)
 */
export function upgradeProject(project: unknown, version: number): unknown {
  // 1 より小さい版や、整数でない版は、version 1 から変える (version 1 より前の形はない)
  let upgraded = project;
  for (let v = Math.max(1, Math.floor(version)); v <= UPGRADES.length; v++) {
    upgraded = UPGRADES[v - 1](upgraded);
  }
  return upgraded;
}
