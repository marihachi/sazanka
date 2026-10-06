// 形式 version 2 のプロジェクトを、version 3 の形に変える。保存データと共有用 JSON の両方で使い、upgrade.ts から呼ぶ。
// version 3 では、回路の部品の一覧を components から parts に、モジュールを指す項目を custom から module に移し、
// 部品の種類の名前をキャメルケースにした。モジュールの回路は、モジュールの形 (package) を持つ。
// INPUT / OUTPUT は、見分けるための番号 (portNumber) を持つ。
// 形式は docs/format/archive/v2.md と docs/format/v3.md。
//
// 今のアプリのコード (部品の型や検証、配置) には頼らない。今のコードが変わっても、この変換の結果が変わらないようにするため。
// 配線は書き換えない。古い版のモジュールは version 2 までの形 (split) にするので、ピンの位置は変わらない

import { isObject } from '../util';

/** version 2 の種類の名前と、version 3 の種類の名前 */
const KIND_NAMES_V3: Record<string, string> = {
  INPUT: 'input',
  OUTPUT: 'output',
  CLOCK: 'clock',
  HIGH: 'high',
  AND: 'and',
  OR: 'or',
  NOT: 'not',
  NAND: 'nand',
  NOR: 'nor',
  XOR: 'xor',
  XNOR: 'xnor',
  RS: 'rsLatch',
  RSEN: 'rsEnLatch',
  DLATCH: 'dLatch',
  DFF: 'dFlipFlop',
  TFF: 'tFlipFlop',
  JKFF: 'jkFlipFlop',
  CUSTOM: 'module',
};

/**
 * 部品 1 つを version 3 の形にする。部品でないもの (オブジェクトでないもの) と、表にない種類の名前は、そのまま残す。
 * 正しい形かどうかは、変換のあとの検証 (今の版の形で行う) で確かめる
 */
function upgradePart(part: unknown): unknown {
  if (!isObject(part)) {
    return part;
  }
  const { custom, ...rest } = part;
  const kind = typeof part.kind === 'string' ? (KIND_NAMES_V3[part.kind] ?? part.kind) : part.kind;
  return {
    ...rest,
    kind,
    ...(custom === undefined ? {} : { module: custom }),
  };
}

/**
 * 回路 1 つを version 3 の形にする。
 * isModule は、モジュールの回路 (回路の一覧の 2 つ目以降) か。モジュールの回路には、version 2 までの形を書き込む
 */
function upgradeCircuit(circuit: unknown, isModule: boolean): unknown {
  if (!isObject(circuit)) {
    return circuit;
  }
  const { components, ...rest } = circuit;
  return {
    ...rest,
    ...(isModule ? { package: { kind: 'split' } } : {}),
    ...(components === undefined
      ? {}
      : {
          parts: Array.isArray(components)
            ? addPortNumbers(components.map(upgradePart))
            : components,
        }),
  };
}

/**
 * INPUT / OUTPUT に、入力と出力で別々に、中の位置の順 (上から、同じ高さなら左から) で 1 から番号を書き込む。
 * 位置が数でない部品は、番号を書かずに残す (検証で断る)
 */
function addPortNumbers(parts: unknown[]): unknown[] {
  const numbers = new Map<unknown, number>();
  for (const kind of ['input', 'output']) {
    const ports = parts
      .filter(isObject)
      .filter((p) => p.kind === kind && typeof p.x === 'number' && typeof p.y === 'number')
      .sort((a, b) => (a.y as number) - (b.y as number) || (a.x as number) - (b.x as number));
    for (const [i, p] of ports.entries()) {
      numbers.set(p, i + 1);
    }
  }
  return parts.map((p) => {
    const n = numbers.get(p);
    return n === undefined ? p : { ...(p as object), portNumber: n };
  });
}

/**
 * version 2 のプロジェクトを、version 3 の形にする。
 * 形の正しくないデータは、分かるところだけを変えて返す (検証で断る)
 */
export function upgradeV2(project: unknown): unknown {
  if (!isObject(project) || !Array.isArray(project.circuits)) {
    return project;
  }
  return {
    ...project,
    circuits: project.circuits.map((c, i) => upgradeCircuit(c, i > 0)),
  };
}
