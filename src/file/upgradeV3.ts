// 形式 version 3 のプロジェクトを、version 4 の形に変える。保存データと共有用 JSON の両方で使い、upgrade.ts から呼ぶ。
// version 4 では、部品の位置と配線の点を px からマス単位の整数にし、回路の ID をプロジェクトをまたいでも重ならないものにした。
// 部品と配線は ID を持たなくなり、配線は種類 (kind) を持つ。
// INPUT / OUTPUT のポート名の項目名を label から portName に変え、メイン回路は name を持たなくなった。
// 形式は docs/format/archive/v3.md と docs/format/v4.md。
//
// 今のアプリのコード (部品の型や検証、配置、マスの大きさ) には頼らない。今のコードが変わっても、この変換の結果が変わらないようにするため

import { isObject } from '../util';

/** version 3 の 1 マスの px */
const CELL_PX = 20;

/** メイン回路の ID。version 4 でも変えない */
const MAIN_ID = 'main';

/**
 * px の座標をマスに直す。いちばん近いマスに丸める (ちょうど中間なら大きい方。Math.round と同じ)。
 * アプリで置いた部品と引いた配線は 20 の倍数なので、割り切れる。部品と配線を同じ規則で丸めるので、
 * 手で書いた 20 の倍数でない値でも、縦横の向きとピンの先とのつながりは保てる。数でない値は、そのまま残す (検証で断る)
 */
function toCells(v: unknown): unknown {
  return typeof v === 'number' ? Math.round(v / CELL_PX) : v;
}

/** 座標を持つオブジェクト (部品と配線の点) の x と y をマスに直す */
function withCells<T extends Record<string, unknown>>(o: T): T {
  return { ...o, x: toCells(o.x), y: toCells(o.y) };
}

/**
 * 部品 1 つを version 4 の形にする。ID を消す (version 4 は部品の ID を保存しない)。
 * moduleIds は、モジュールの回路の古い ID から新しい ID への対応
 */
function upgradePart(part: unknown, moduleIds: Map<string, string>): unknown {
  if (!isObject(part)) {
    return part;
  }
  const { id: _, label, ...rest } = part;
  const module =
    typeof part.module === 'string' ? (moduleIds.get(part.module) ?? part.module) : part.module;
  return {
    ...withCells(rest),
    ...(label === undefined ? {} : { portName: label }),
    ...(module === undefined ? {} : { module }),
  };
}

/**
 * 配線 1 本を version 4 の形にする。ID を消し (version 4 は配線の ID を保存しない)、種類 wire を書く。
 * version 3 の配線は、どれも普通の配線
 */
function upgradeWire(wire: unknown): unknown {
  if (!isObject(wire)) {
    return wire;
  }
  const { id: _, ...rest } = wire;
  return {
    kind: 'wire',
    ...rest,
    points: Array.isArray(wire.points)
      ? wire.points.map((p) => (isObject(p) ? withCells(p) : p))
      : wire.points,
  };
}

/**
 * 回路 1 つを version 4 の形にする。isModule は、モジュールの回路 (回路の一覧の 2 つ目以降) か。
 * メイン回路は ID を変えず、名前を消す
 */
function upgradeCircuit(
  circuit: unknown,
  isModule: boolean,
  moduleIds: Map<string, string>,
): unknown {
  if (!isObject(circuit)) {
    return circuit;
  }
  const { name, ...rest } = circuit;
  const id =
    typeof circuit.id === 'string' ? (moduleIds.get(circuit.id) ?? circuit.id) : circuit.id;
  return {
    ...rest,
    id,
    ...(isModule ? { name } : {}),
    parts: Array.isArray(circuit.parts)
      ? circuit.parts.map((p) => upgradePart(p, moduleIds))
      : circuit.parts,
    wires: Array.isArray(circuit.wires) ? circuit.wires.map(upgradeWire) : circuit.wires,
  };
}

/**
 * モジュールの回路の、古い ID から新しい ID への対応を作る。
 * 同じ ID の回路が 2 つあれば、同じ新しい ID にする (重なったまま残して、検証で断る)。
 * "main" はメイン回路の ID なので付け直さない (モジュールが "main" を持っていれば、重なったまま残して検証で断る)
 */
function renewModuleIds(circuits: unknown[], newId: () => string): Map<string, string> {
  const ids = new Map<string, string>();
  for (const c of circuits.slice(1)) {
    if (isObject(c) && typeof c.id === 'string' && c.id !== MAIN_ID && !ids.has(c.id)) {
      ids.set(c.id, newId());
    }
  }
  return ids;
}

/**
 * version 3 のプロジェクトを、version 4 の形にする。モジュールの回路の新しい ID は newId で作る。
 * version 3 の ID は回路をまたいで重なりうる (共有用 JSON の part-1 など) ので、回路の ID は付け直し、部品と配線の ID は消す。
 * 形の正しくないデータは、分かるところだけを変えて返す (検証で断る)
 */
export function upgradeV3(project: unknown, newId: () => string): unknown {
  if (!isObject(project) || !Array.isArray(project.circuits)) {
    return project;
  }
  const moduleIds = renewModuleIds(project.circuits, newId);
  return {
    ...project,
    circuits: project.circuits.map((c, i) => upgradeCircuit(c, i > 0, moduleIds)),
  };
}
