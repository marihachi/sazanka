// 回路の編集 (部品・配線・ラベルの追加や変更や削除、コピーと貼り付け) と、編集の対象として選んでいるものの形。
// どれも新しい回路を返し、元の回路は書き換えない。
// 元に戻す対象にするかどうかは、使う側 (app/App.tsx) が useProjectHistory.ts で決める

import type { Point } from '../geometry/layout';
import type { Part } from '../circuit/part';
import type { Circuit, Wire } from '../circuit/circuit';

/** 選んでいる部品と配線。どちらも複数を同時に選べる。何も選んでいなければ null (両方が空のものは作らない) */
export type Selection = { comps: string[]; wires: string[] } | null;

/** 部品と配線の ID から選択を作る。どちらも空なら null */
export function selectionOf(comps: readonly string[], wires: readonly string[]): Selection {
  return comps.length > 0 || wires.length > 0 ? { comps: [...comps], wires: [...wires] } : null;
}

/**
 * 配線の結合で消えた配線を選んでいたら、結合後の配線を選ぶ。
 * replaced は、結合で消えた配線の ID → 結合後の配線の ID (geometry/net.ts の mergeWiresAt)
 */
export function remapSelection(
  selection: Selection,
  replaced: ReadonlyMap<string, string>,
): Selection {
  if (!selection || replaced.size === 0) {
    return selection;
  }
  // 結合した 2 本を両方選んでいたときに、同じ ID が 2 つ並ばないようにする
  const wires = [...new Set(selection.wires.map((id) => replaced.get(id) ?? id))];
  return selectionOf(selection.comps, wires);
}

function updatePart<T extends Circuit>(circuit: T, id: string, update: (c: Part) => Part): T {
  return {
    ...circuit,
    parts: circuit.parts.map((c) => (c.id === id ? update(c) : c)),
  };
}

export function addPart<T extends Circuit>(circuit: T, c: Part): T {
  return { ...circuit, parts: [...circuit.parts, c] };
}

export function addWire<T extends Circuit>(circuit: T, wire: Wire): T {
  return { ...circuit, wires: [...circuit.wires, wire] };
}

/** 部品と配線をまとめて削除する。配線は部品とは別に存在するので、部品を消してもつながっていた配線は残る */
export function removeParts<T extends Circuit>(
  circuit: T,
  comps: readonly string[],
  wires: readonly string[],
): T {
  const compSet = new Set(comps);
  const wireSet = new Set(wires);
  return {
    ...circuit,
    parts: circuit.parts.filter((c) => !compSet.has(c.id)),
    wires: circuit.wires.filter((w) => !wireSet.has(w.id)),
  };
}

/**
 * 部品と配線をまとめて動かす。comps は部品の新しい位置、wires は配線の新しい点の並び。
 * どちらにもないものはそのまま。配線は部品についてこないので、部品だけを動かすとつながりが切れる
 */
export function moveParts<T extends Circuit>(
  circuit: T,
  comps: ReadonlyMap<string, Point>,
  wires: ReadonlyMap<string, Point[]> = new Map(),
): T {
  return {
    ...circuit,
    parts: circuit.parts.map((c) => {
      const p = comps.get(c.id);
      return p ? { ...c, x: p.x, y: p.y } : c;
    }),
    wires: circuit.wires.map((w) => {
      const points = wires.get(w.id);
      return points ? { ...w, points } : w;
    }),
  };
}

export function toggleSwitch<T extends Circuit>(circuit: T, id: string): T {
  return updatePart(circuit, id, (c) => ({ ...c, on: !c.on }));
}

/** CLOCK の周期 (一往復の tick 数) を変える */
export function setClockPeriod<T extends Circuit>(circuit: T, id: string, period: number): T {
  return updatePart(circuit, id, (c) => ({ ...c, period }));
}

/** 空白だけのラベルは、ラベルなしにする */
export function setLabel<T extends Circuit>(circuit: T, id: string, value: string): T {
  return updatePart(circuit, id, (c) => ({
    ...c,
    label: value.trim() || undefined,
  }));
}

/** コピー用に、選んだ部品と配線だけを取り出す */
export function extractParts(
  circuit: Circuit,
  comps: readonly string[],
  wires: readonly string[],
): Circuit {
  const compSet = new Set(comps);
  const wireSet = new Set(wires);
  return {
    parts: circuit.parts.filter((c) => compSet.has(c.id)),
    wires: circuit.wires.filter((w) => wireSet.has(w.id)),
  };
}

/** 貼り付け用に、部品と配線へ newId で新しい ID を付け、どちらも delta だけずらす */
export function cloneParts(fragment: Circuit, newId: () => string, delta: Point): Circuit {
  return {
    parts: fragment.parts.map((c) => ({
      ...c,
      id: newId(),
      x: c.x + delta.x,
      y: c.y + delta.y,
    })),
    wires: fragment.wires.map((w) => ({
      ...w,
      id: newId(),
      points: w.points.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y })),
    })),
  };
}

/** 部品と配線をまとめて足す。ID が回路の中の既存のものと重ならない前提 (cloneParts で付け直したもの) */
export function addParts<T extends Circuit>(circuit: T, fragment: Circuit): T {
  return {
    ...circuit,
    parts: [...circuit.parts, ...fragment.parts],
    wires: [...circuit.wires, ...fragment.wires],
  };
}
