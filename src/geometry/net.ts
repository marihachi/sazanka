// ネット: 配線とピンの、位置によるつながり。
// 配線の端が、ピンの先か、ほかの配線の上 (端・折れる点・途中) にあれば、同じネットになる。
// 配線の途中どうしが交わるだけ (交差) ではつながらない

import type { Circuit, PinRef, Wire } from '../circuit/circuit';
import { getPinout } from '../circuit/module';
import type { Project } from '../circuit/project';
import type { Part } from '../circuit/part';
import { calcSheetPins, type Point, simplifyWire } from './layout';
import { mustGet } from '../util';

/** 配線でつながったピンと配線のまとまり */
export interface Net {
  /** つながっている出力ピン。2 つ以上なら、値がぶつかるエラー (conflict) */
  outputs: PinRef[];
  inputs: PinRef[];
  /** ネットに含まれる配線の ID */
  wires: string[];
}

export interface Nets {
  /** 配線が 1 本以上あるネット。配線のないピンは含めない */
  nets: Net[];
  /** 配線 ID → その配線のネット */
  wireNet: Map<string, Net>;
  /** 分岐の印を描く点 (3 本以上の線が集まる接続点) と、そこを通る配線の 1 本 (色を決めるのに使う) */
  junctions: { at: Point; wire: string }[];
}

/** 出力ピンが 2 つ以上つながったネット (値が決まらないエラー) か */
export function isConflict(net: Net): boolean {
  return net.outputs.length > 1;
}

/** 点 p が、a と b を結ぶ線分の上 (両端を含む) にあるか */
function onSegment(p: Point, a: Point, b: Point): boolean {
  // a→b と a→p の外積が 0 なら同じ直線の上。そのうえで、a と b を対角とする長方形の中にあれば線分の上
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  return (
    cross === 0 &&
    p.x >= Math.min(a.x, b.x) &&
    p.x <= Math.max(a.x, b.x) &&
    p.y >= Math.min(a.y, b.y) &&
    p.y <= Math.max(a.y, b.y)
  );
}

/** 点 p が配線の上 (端・折れる点・途中) にあるか */
export function isOnWire(p: Point, wire: Wire): boolean {
  return wire.points.some((b, i) => i > 0 && onSegment(p, wire.points[i - 1], b));
}

/** 点 p が配線の端にあるか */
function isWireEnd(p: Point, wire: Wire): boolean {
  const first = wire.points[0];
  const last = wire.points[wire.points.length - 1];
  return (p.x === first.x && p.y === first.y) || (p.x === last.x && p.y === last.y);
}

function pointKey(p: Point): string {
  return `${p.x},${p.y}`;
}

/** 回路の配線とピンを、つながりごとのネットに分ける */
export function computeNets(circuit: Circuit, project: Project): Nets {
  // ピンの先の位置 → そこにあるピン
  const pinsAt = new Map<string, { ref: PinRef; output: boolean }[]>();
  for (const c of circuit.parts) {
    const add = (p: Point, ref: PinRef, output: boolean) => {
      const k = pointKey(p);
      pinsAt.set(k, [...(pinsAt.get(k) ?? []), { ref, output }]);
    };
    // 配置は部品ごとに 1 回だけ求める。ピンごとに求めると、ピンの多いモジュール (128 ピンなど) で重くなるため
    const pins = calcSheetPins(c, getPinout(c, project));
    for (const [i, p] of pins.inputs.entries()) {
      add(p.tip, { comp: c.id, pin: i }, false);
    }
    for (const [i, p] of pins.outputs.entries()) {
      add(p.tip, { comp: c.id, pin: i }, true);
    }
  }

  // 配線を union-find でまとめる。parent[i] は wires[i] の親 (根なら自分)
  const wires = circuit.wires;
  const parent = wires.map((_, i) => i);
  const root = (i: number): number => {
    let r = i;
    while (parent[r] !== r) {
      r = parent[r];
    }
    parent[i] = r;
    return r;
  };
  const union = (a: number, b: number) => {
    parent[root(a)] = root(b);
  };

  // 配線の端ごとに、そこにあるピンと、その点を通る配線を調べる。
  // 配線の数が多くても調べる組を減らせるよう、区間を、横線は y、縦線は x ごとに分けておく
  const horizontal = new Map<number, number[]>();
  const vertical = new Map<number, number[]>();
  wires.forEach((w, i) => {
    w.points.forEach((b, j) => {
      if (j === 0) {
        return;
      }
      const a = w.points[j - 1];
      if (a.y === b.y) {
        horizontal.set(a.y, [...(horizontal.get(a.y) ?? []), i]);
      }
      if (a.x === b.x) {
        vertical.set(a.x, [...(vertical.get(a.x) ?? []), i]);
      }
    });
  });
  /** 点 p を通る配線の番号 (同じ配線は 1 度だけ) */
  const wiresThrough = (p: Point): number[] => {
    const candidates = new Set([...(horizontal.get(p.y) ?? []), ...(vertical.get(p.x) ?? [])]);
    return [...candidates].filter((i) => isOnWire(p, wires[i]));
  };

  // 配線の番号 → その端にあるピン
  const pinsOfWire = wires.map(() => [] as { ref: PinRef; output: boolean }[]);
  /** 配線の端のある点。分岐の印を描くかを、あとでここだけ調べる */
  const ends = new Map<string, Point>();
  wires.forEach((w, i) => {
    for (const p of [w.points[0], w.points[w.points.length - 1]]) {
      ends.set(pointKey(p), p);
      pinsOfWire[i].push(...(pinsAt.get(pointKey(p)) ?? []));
      for (const j of wiresThrough(p)) {
        if (j !== i) {
          union(i, j);
        }
      }
    }
  });

  // 根ごとにネットを作る。同じピンに 2 本の配線の端があっても、ピンは 1 回だけ数える
  const byRoot = new Map<number, { net: Net; seen: Set<string> }>();
  const wireNet = new Map<string, Net>();
  wires.forEach((w, i) => {
    const r = root(i);
    let entry = byRoot.get(r);
    if (!entry) {
      entry = { net: { outputs: [], inputs: [], wires: [] }, seen: new Set() };
      byRoot.set(r, entry);
    }
    const { net, seen } = entry;
    net.wires.push(w.id);
    wireNet.set(w.id, net);
    for (const { ref, output } of pinsOfWire[i]) {
      const k = `${output ? 'out' : 'in'}:${ref.comp}:${ref.pin}`;
      if (!seen.has(k)) {
        seen.add(k);
        (output ? net.outputs : net.inputs).push(ref);
      }
    }
  });

  // 分岐の印: 配線の端のある点で、集まる線の数を数え、3 以上なら描く。
  // 配線の端なら 1 本、途中 (折れる点を含む) を通るなら、その点から両側に出るので 2 本、ピンは 1 本と数える。
  // 例: T 字の分岐は 1 + 2 = 3、配線の端どうしは 1 + 1 = 2、ピンに配線の端は 1 + 1 = 2
  const junctions: { at: Point; wire: string }[] = [];
  for (const [k, p] of ends) {
    let arms = pinsAt.get(k)?.length ?? 0;
    const through = wiresThrough(p);
    for (const i of through) {
      const w = wires[i];
      if (isWireEnd(p, w)) {
        // 両端が同じ点にある (輪になった) 配線は 2 本と数える
        const first = w.points[0];
        const last = w.points[w.points.length - 1];
        arms += first.x === last.x && first.y === last.y ? 2 : 1;
      } else {
        arms += 2;
      }
    }
    if (arms >= 3) {
      junctions.push({ at: p, wire: wires[through[0]].id });
    }
  }

  return { nets: [...byRoot.values()].map((e) => e.net), wireNet, junctions };
}

/**
 * 入力ピン → それを動かす出力ピン の組。出力ピンがちょうど 1 つのネットだけから作る。
 * 出力ピンのないネットや、2 つ以上ある (ぶつかる) ネットの入力ピンは含めない (OFF として扱われる)
 */
export function netLinks(nets: readonly Net[]): { from: PinRef; to: PinRef }[] {
  return nets.flatMap((net) =>
    net.outputs.length === 1 ? net.inputs.map((to) => ({ from: net.outputs[0], to })) : [],
  );
}

/** 部品の入力ピンと出力ピンの先の位置 (つながりに使うピン。NC のピンは含めない) */
export function pinTipsOf(parts: readonly Part[], project: Project): Point[] {
  return parts.flatMap((c) => {
    const pins = calcSheetPins(c, getPinout(c, project));
    return [...pins.inputs, ...pins.outputs].map((p) => p.tip);
  });
}

/** 配線の両端 */
export function wireEndsOf(wires: readonly Wire[]): Point[] {
  return wires.flatMap((w) => [w.points[0], w.points[w.points.length - 1]]);
}

/**
 * 点 points のうち、2 本の配線が 1 本に見えている点で、その 2 本を 1 本に結合する。
 * 結合するのは、2 本の配線の端だけがあり、ピンの先もほかの配線の途中もない点 (分岐の点では結合しない)。
 * 端どうしが同じ点にある 2 本はもともと同じネットなので、結合してもつながりは変わらない。
 * 結合した配線は、回路の中で先にある方の ID と向きを引き継ぐ。
 * replaced は、結合で消えた配線の ID → 結合後の配線の ID (選択を引き継ぐのに使う)
 */
export function mergeWiresAt<T extends Circuit>(
  circuit: T,
  project: Project,
  points: readonly Point[],
): { circuit: T; replaced: Map<string, string> } {
  const tips = new Set(pinTipsOf(circuit.parts, project).map(pointKey));
  let wires = circuit.wires;
  const replaced = new Map<string, string>();
  const done = new Set<string>();
  for (const p of points) {
    const k = pointKey(p);
    if (done.has(k) || tips.has(k)) {
      continue;
    }
    done.add(k);
    const through = wires.filter((w) => isOnWire(p, w));
    // 点を通る配線が 2 本で、どちらもその点が端であること。途中を通る配線があれば分岐か交差
    if (through.length !== 2 || !through.every((w) => isWireEnd(p, w))) {
      continue;
    }
    const [a, b] = through;
    const joined = joinAt(a.points, b.points, p);
    if (!joined) {
      continue;
    }
    // through は wires の並び順なので、a が先にある方
    wires = wires.flatMap((w) => (w === a ? [{ ...a, points: joined }] : w === b ? [] : [w]));
    replaced.set(b.id, a.id);
  }
  // 結合が続いたとき (b → a、a → c) は、最後に残った配線を指すようにたどる
  for (const [from, to] of replaced) {
    let last = to;
    while (replaced.has(last)) {
      last = mustGet(replaced, last);
    }
    replaced.set(from, last);
  }
  return { circuit: { ...circuit, wires }, replaced };
}

/**
 * 点 p に端がある 2 本の点の並びを、p でつないだ 1 本にする。a の向きを保つ。
 * つなげない (同じ向きに出ていて重なる、どちらかの両端が p にある) ときは null
 */
function joinAt(a: readonly Point[], b: readonly Point[], p: Point): Point[] | null {
  const at = (q: Point) => q.x === p.x && q.y === p.y;
  const aEnd = at(a[a.length - 1]);
  const aStart = at(a[0]);
  const bStart = at(b[0]);
  const bEnd = at(b[b.length - 1]);
  // 両端が p にある配線 (輪) は、どちらの端でつなぐかが決まらないので結合しない
  if ((aStart && aEnd) || (bStart && bEnd)) {
    return null;
  }
  // a を「p で終わる向き」、b を「p から始まる向き」にそろえてつなぐ。a が p で始まるときは、
  // b → a の順につなげば a の向きのまま (b を「p で終わる向き」にして前に置く)
  const head = aEnd ? [...a] : bEnd ? [...b] : [...b].reverse();
  const tail = aEnd ? (bStart ? [...b] : [...b].reverse()) : [...a];
  // p の手前の点と、p の次の点が同じ側にあれば、2 本は p から同じ向きに出ていて重なる
  const before = head[head.length - 2];
  const after = tail[1];
  if (
    Math.sign(before.x - p.x) === Math.sign(after.x - p.x) &&
    Math.sign(before.y - p.y) === Math.sign(after.y - p.y)
  ) {
    return null;
  }
  return simplifyWire([...head, ...tail.slice(1)]);
}
