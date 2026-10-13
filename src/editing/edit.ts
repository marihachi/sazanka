// 回路の編集 (部品・配線・ポート名の追加や変更や削除、コピーと貼り付け) と、編集の対象として選んでいるものの形。
// どれも新しい回路を返し、元の回路は書き換えない。
// 元に戻す対象にするかどうかは、使う側 (app/App.tsx) が useProjectHistory.ts で決める

import {
  bodySize,
  clampPosition,
  clampToSheet,
  GRID,
  type Point,
  simplifyWire,
} from '../geometry/layout';
import { onSegment } from '../geometry/net';
import type { Part } from '../circuit/part';
import type { Circuit, Wire } from '../circuit/circuit';
import type { Pinout } from '../circuit/module';
import type { CircuitSheet } from '../circuit/project';
import type { Rotation } from '../parts/layout';

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

/** 回す向き。cw は時計回り、ccw は反時計回り (どちらも 90 度) */
export type TurnDirection = 'cw' | 'ccw';

/**
 * 部品と配線をまとめて、全体の中心の回りに 90 度回す。部品は位置と向き (rotation) が、配線は点が変わる。
 * 回す中心の決め方は turnCenter。回した後も、グリッドに乗った位置とピンの先はグリッドに乗る。
 * 同じものを 4 回回すと元の位置に戻り、時計回りと反時計回りは打ち消し合う。
 * sheet を渡すと、回した後にどれかがシートからはみ出すときは回さず、undefined を返す。
 * 渡さなければはみ出しを見ない (貼り付け中のように、あとで置く位置を決めるとき)
 */
export function rotateParts<T extends Circuit>(
  circuit: T,
  comps: readonly string[],
  wires: readonly string[],
  direction: TurnDirection,
  pinoutOf: (c: Part) => Pinout,
  sheet?: CircuitSheet,
): T | undefined {
  const compSet = new Set(comps);
  const wireSet = new Set(wires);
  const parts = circuit.parts.filter((c) => compSet.has(c.id));
  const points = circuit.wires.filter((w) => wireSet.has(w.id)).flatMap((w) => w.points);
  if (parts.length === 0 && points.length === 0) {
    return circuit;
  }
  // 部品の本体の角と配線の点。どれも回すと一緒に回るので、これを囲む長方形も形を変えずに回る
  const corners = [
    ...parts.flatMap((c) => {
      const { w, h } = bodySize(c, pinoutOf(c));
      return [
        { x: c.x, y: c.y },
        { x: c.x + w, y: c.y + h },
      ];
    }),
    ...points,
  ];
  const center = turnCenter(corners);
  const turn = (p: Point) => turnPoint(p, center, direction);

  const turnedParts = new Map<string, Part>();
  for (const c of parts) {
    const { w, h } = bodySize(c, pinoutOf(c));
    // 本体の 4 つの角を回し、いちばん左上に来た点が回した後の本体の左上
    const corners = [
      { x: c.x, y: c.y },
      { x: c.x + w, y: c.y },
      { x: c.x, y: c.y + h },
      { x: c.x + w, y: c.y + h },
    ].map(turn);
    const rotation = (((c.rotation ?? 0) + (direction === 'cw' ? 90 : 270)) % 360) as Rotation;
    const { rotation: _, ...rest } = c;
    turnedParts.set(c.id, {
      ...rest,
      x: Math.min(...corners.map((p) => p.x)),
      y: Math.min(...corners.map((p) => p.y)),
      // 0 度のときは持たせない (保存データに書かないため)
      ...(rotation === 0 ? {} : { rotation }),
    });
  }
  const turnedWires = new Map<string, Point[]>(
    circuit.wires.filter((w) => wireSet.has(w.id)).map((w) => [w.id, w.points.map(turn)]),
  );

  if (sheet) {
    const outside =
      [...turnedParts.values()].some((c) => {
        const p = clampPosition(c, pinoutOf(c), c, sheet);
        return p.x !== c.x || p.y !== c.y;
      }) ||
      [...turnedWires.values()].some((ps) =>
        ps.some((p) => {
          const q = clampToSheet(p, sheet);
          return q.x !== p.x || q.y !== p.y;
        }),
      );
    if (outside) {
      return undefined;
    }
  }
  return {
    ...circuit,
    parts: circuit.parts.map((c) => turnedParts.get(c.id) ?? c),
    wires: circuit.wires.map((w) => {
      const ps = turnedWires.get(w.id);
      return ps ? { ...w, points: ps } : w;
    }),
  };
}

/**
 * 点の集まりを回す中心。点を囲む長方形の中心を、グリッドを保てる点に合わせる。
 * マス単位で、中心の x と y が両方とも整数か、両方とも整数 + 0.5 なら、そこを中心にして、
 * 回したグリッドの点はグリッドの点に移る (例: (0.5, 0.5) の回りに (0, 0) を時計回りに回すと (1, 0))。
 * 片方だけが整数 + 0.5 のとき (長方形の幅と高さのマスの数の偶奇が違うとき) は、その座標を隣の整数のどちらかに寄せる。
 * 寄せる先は、中心の x + y (マス) が偶数になる方。こう決めると、4 回回したときと、時計回りの後に反時計回りにしたときに、
 * 寄せた分が打ち消し合い、元の位置に戻る (いつも同じ向きに寄せると、回すたびに少しずつずれていく)
 */
function turnCenter(points: readonly Point[]): Point {
  // 長方形の中心 (マス)。0.5 刻みになる
  const cx = (Math.min(...points.map((p) => p.x)) + Math.max(...points.map((p) => p.x))) / 2 / GRID;
  const cy = (Math.min(...points.map((p) => p.y)) + Math.max(...points.map((p) => p.y))) / 2 / GRID;
  const halfX = !Number.isInteger(cx);
  const halfY = !Number.isInteger(cy);
  if (halfX === halfY) {
    return { x: cx * GRID, y: cy * GRID };
  }
  if (halfX) {
    const x = Math.floor(cx);
    return { x: (isEven(x + cy) ? x : x + 1) * GRID, y: cy * GRID };
  }
  const y = Math.floor(cy);
  return { x: cx * GRID, y: (isEven(cx + y) ? y : y + 1) * GRID };
}

function isEven(n: number): boolean {
  return ((n % 2) + 2) % 2 === 0;
}

/**
 * 点 p を、点 center の回りに 90 度回す。シートの座標は y が下へ増えるので、
 * 時計回りは (dx, dy) → (−dy, dx)。例: 中心の右 (dx, dy) = (20, 0) は、中心の下 (0, 20) へ移る
 */
function turnPoint(p: Point, center: Point, direction: TurnDirection): Point {
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return direction === 'cw'
    ? { x: center.x - dy, y: center.y + dx }
    : { x: center.x + dy, y: center.y - dx };
}

/** 配線の点の並びを変える (端のドラッグで長さを変えたときなど) */
export function setWirePoints<T extends Circuit>(circuit: T, id: string, points: Point[]): T {
  return {
    ...circuit,
    wires: circuit.wires.map((w) => (w.id === id ? { ...w, points } : w)),
  };
}

/**
 * 配線を点 at で 2 本に分ける。at は配線の途中か折れる点 (端ではない) で、分けてよい点の前提
 * (geometry/net.ts の findSplitTarget で確かめてから呼ぶ)。
 * 前の方が元の ID を引き継ぎ、後ろの方には newId で新しい ID を付けて、元の配線のすぐ後ろに置く
 */
export function splitWire<T extends Circuit>(
  circuit: T,
  id: string,
  at: Point,
  newId: () => string,
): T {
  return {
    ...circuit,
    wires: circuit.wires.flatMap((w) => {
      if (w.id !== id) {
        return [w];
      }
      // at を含む最初の区間 (points[i - 1] → points[i]) の間で分ける。at が折れる点なら、
      // 前の区間の終わりで分けることになり、at が 2 回並ぶので simplifyWire で省く
      const i = w.points.findIndex((b, j) => j > 0 && onSegment(at, w.points[j - 1], b));
      if (i < 0) {
        return [w];
      }
      const head = simplifyWire([...w.points.slice(0, i), at]);
      const tail = simplifyWire([at, ...w.points.slice(i)]);
      return [
        { ...w, points: head },
        { id: newId(), points: tail },
      ];
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

/** INPUT / OUTPUT のポート名を変える。空白だけなら名前未設定にする */
export function setPortName<T extends Circuit>(circuit: T, id: string, value: string): T {
  return updatePart(circuit, id, (c) => ({
    ...c,
    portName: value.trim() || undefined,
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
