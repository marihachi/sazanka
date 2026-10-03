// ネット: 配線とピンの、位置によるつながり。
// 配線の端が、ピンの先か、ほかの配線の上 (端・折れる点・途中) にあれば、同じネットになる。
// 配線の途中どうしが交わるだけ (交差) ではつながらない

import type { Circuit, PinRef, Wire } from '../circuit/circuit';
import { portsOf } from '../circuit/module';
import type { Project } from '../circuit/project';
import { inputPinPos, outputPinPos, type Point } from './layout';

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
  for (const c of circuit.components) {
    const ports = portsOf(c, project);
    const add = (p: Point, ref: PinRef, output: boolean) => {
      const k = pointKey(p);
      pinsAt.set(k, [...(pinsAt.get(k) ?? []), { ref, output }]);
    };
    for (let i = 0; i < ports.inputs.length; i++) {
      add(inputPinPos(c, ports, i), { comp: c.id, pin: i }, false);
    }
    for (let i = 0; i < ports.outputs.length; i++) {
      add(outputPinPos(c, ports, i), { comp: c.id, pin: i }, true);
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
