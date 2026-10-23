// 一体の形式 version 4 のプロジェクトを、プロジェクトの形式 version 1 の形に変える。読み込みの入口 (upgrade/index.ts) から呼ぶ。
// プロジェクトの形式 v1 は、形式の目印 (format) と版 (version)、フォルダの一覧 (folders)、要素の並び (circuits) を持つ。
// 要素は、フォルダのパス (path) と、回路の形式のデータ (circuit) の組。プロジェクトは作者名を持たず、回路が持つ。
// 同じフォルダの中の回路の名前は重ならず、メイン回路以外の名前は空にできない。
// 形式は docs/format/integrated/v4.md と docs/format/project/v1.md。
//
// 今のアプリのコードには頼らない。今のコードが変わっても、この変換の結果が変わらないようにするため

import { isObject } from '../../../util';
import { upgradeToCircuitV1, type V1CircuitSize, v4ModuleSize } from '../circuit/v1';

/** メイン回路の ID。プロジェクトの形式 v1 でも変えない */
const MAIN_ID = 'main';

/** 名前が空の回路に付ける名前の頭 (アプリで回路を追加するときの、日本語の既定の名前と同じ形) */
const UNNAMED_PREFIX = '回路';

/** 名前が空か (空白だけを含むものも空とみなす) */
function isBlank(name: unknown): boolean {
  return typeof name === 'string' && name.trim() === '';
}

/**
 * 回路の並びから、変換後の回路の名前を決める (回路の並びと同じ順。メイン回路の分は undefined)。
 * 名前が空の回路には「回路<n>」(n はほかと重ならないいちばん小さい数) を付け、
 * そのあと、同じ名前が並びの前にあれば ` (2)`、` (3)` などを付ける。付けた名前が並びのどこかの名前と重なるなら、次の数にする。
 * 文字列でない名前は、そのまま残す (検証で断る)
 */
function decideNames(circuits: unknown[]): unknown[] {
  const isSub = (c: unknown) => isObject(c) && c.id !== MAIN_ID;
  const original = circuits.map((c) =>
    isSub(c) ? (c as Record<string, unknown>).name : undefined,
  );
  // 名前がもともと付いているもの。付ける名前は、これと重ならないようにする
  const given = new Set(original.filter((n): n is string => typeof n === 'string' && !isBlank(n)));

  let unnamed = 1;
  const named = original.map((n) => {
    if (!isBlank(n)) {
      return n;
    }
    while (given.has(`${UNNAMED_PREFIX}${unnamed}`)) {
      unnamed++;
    }
    const name = `${UNNAMED_PREFIX}${unnamed}`;
    given.add(name);
    return name;
  });

  // 前から順に、すでに使われた名前と重なれば数を付ける。付けた名前は、もともとの名前ともあとの名前とも重ならないようにする
  const all = new Set(named.filter((n): n is string => typeof n === 'string'));
  const used = new Set<string>();
  return named.map((n, i) => {
    if (!isSub(circuits[i]) || typeof n !== 'string') {
      return n;
    }
    if (!used.has(n)) {
      used.add(n);
      return n;
    }
    let k = 2;
    while (used.has(`${n} (${k})`) || all.has(`${n} (${k})`)) {
      k++;
    }
    const name = `${n} (${k})`;
    used.add(name);
    all.add(name);
    return name;
  });
}

/**
 * 一体の形式 version 4 のプロジェクトを、プロジェクトの形式 version 1 にする。
 * 回路の並びを、同じ並びのまま要素の並びにし、どの回路もフォルダなし (`""`) に置く。
 * プロジェクトの作者名は、すべての回路 (メイン回路を含む) の作者名に写す (なければ空文字)。
 * 形の正しくないデータは、分かるところだけを変えて返す (検証で断る)
 */
export function upgradeToProjectV1(project: unknown): unknown {
  if (!isObject(project) || !Array.isArray(project.circuits)) {
    return project;
  }
  const circuits = project.circuits;
  const names = decideNames(circuits);
  const circuitNames = new Map<string, string>();
  const circuitSizes = new Map<string, V1CircuitSize>();
  circuits.forEach((c, i) => {
    const name = names[i];
    if (isObject(c) && typeof c.id === 'string' && typeof name === 'string') {
      circuitNames.set(c.id, name);
    }
    const size = v4ModuleSize(c);
    if (isObject(c) && typeof c.id === 'string' && size) {
      circuitSizes.set(c.id, size);
    }
  });
  const author = project.author === undefined ? '' : project.author;
  return {
    format: 'sazanka-project',
    version: 1,
    folders: [],
    circuits: circuits.map((c, i) => ({
      path: '',
      circuit: upgradeToCircuitV1(c, { author, name: names[i], circuitNames, circuitSizes }),
    })),
  };
}
