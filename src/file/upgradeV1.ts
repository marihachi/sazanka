// 形式 version 1 のプロジェクトを、今の形 (version 2) に変える。保存データと共有用 JSON の両方で使う。
// version 1 の配線は、出力ピンと入力ピンを部品 ID とピン番号で指し、形は通る点から自動で決めていた。
// version 2 の配線は、通る点の並びそのもの (circuit/circuit.ts の Wire)。形式は docs/format/archive/v1.md

import { isComponent, type Component } from '../circuit/component';
import { isPinRef, isPoint, type PinRef, type Wire } from '../circuit/circuit';
import { portsOf } from '../circuit/module';
import type { Project } from '../circuit/project';
import { inputPinPos, outputPinPos, type Point, snap } from '../geometry/layout';
import { isObject } from '../util';

/** version 1 の配線 */
interface WireV1 {
  id: string;
  from: PinRef;
  to: PinRef;
  points?: Point[];
}

function isWireV1(w: unknown): w is WireV1 {
  return (
    isObject(w) &&
    typeof w.id === 'string' &&
    isPinRef(w.from) &&
    isPinRef(w.to) &&
    (w.points === undefined || (Array.isArray(w.points) && w.points.every(isPoint)))
  );
}

/**
 * version 1 の配線が通る点の並び (曲がり角を含む)。version 1 のアプリが描いていた形と同じにする。
 * from は出力ピンの先、to は入力ピンの先、points は利用者が置いた折れる点。
 * 出力ピンからは横に出て、入力ピンへは横から入るよう、最後の区間だけ縦→横、ほかは横→縦の順に曲がる。
 * 折れる点がなければ、中間で1回折れる形にする
 */
export function routeV1(from: Point, points: readonly Point[], to: Point): Point[] {
  // 例: 折れる点が p 1 つなら from → (p.x, from.y) → p → (p.x, to.y) → to
  const route: Point[] = [from];
  if (points.length === 0) {
    // 両端の x の真ん中 (グリッドに合わせる) で縦に折れる
    const mid = snap((from.x + to.x) / 2);
    route.push({ x: mid, y: from.y }, { x: mid, y: to.y });
  } else {
    let cur = from;
    for (const p of points) {
      route.push({ x: p.x, y: cur.y }, p);
      cur = p;
    }
    route.push({ x: cur.x, y: to.y });
  }
  route.push(to);
  return simplify(route);
}

/**
 * 同じ点が続くところと、前後とまっすぐ並んで曲がらない点を省く。
 * 両端が同じ高さのときなどに、長さ 0 の区間や、曲がらない「角」が残らないようにする
 */
function simplify(route: Point[]): Point[] {
  // 1 回目: 直前と同じ点を除く。2 回目: 前後と同じ縦線か横線の上にある点 (曲がらない点) を除く
  const distinct = route.filter(
    (p, i) => i === 0 || p.x !== route[i - 1].x || p.y !== route[i - 1].y,
  );
  return distinct.filter((p, i) => {
    if (i === 0 || i === distinct.length - 1) {
      return true;
    }
    const [a, b] = [distinct[i - 1], distinct[i + 1]];
    return !((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y));
  });
}

/**
 * version 1 のプロジェクトの配線を、通る点の並びに変える。
 * 存在しない部品やピンを指す配線は、位置が決まらないので捨てる。
 * 形が正しくないデータは、配線をそのまま残す (このあとの検証 checkProject で断る)
 */
export function upgradeV1(project: unknown): unknown {
  if (!isObject(project) || !Array.isArray(project.circuits)) {
    return project;
  }
  const circuits = project.circuits as unknown[];
  // モジュールのピンの数を引くのに、回路の部品だけを見る (portsOf は回路の components しか使わない)
  const valid = circuits.every(
    (d) =>
      isObject(d) &&
      typeof d.id === 'string' &&
      Array.isArray(d.components) &&
      d.components.every(isComponent),
  );
  if (!valid) {
    return project;
  }
  const lookup = { circuits } as unknown as Project;
  return {
    ...project,
    circuits: circuits.map((raw) => {
      const d = raw as { components: Component[]; wires?: unknown };
      if (!Array.isArray(d.wires)) {
        return d;
      }
      const comps = new Map(d.components.map((c) => [c.id, c]));
      const wires = d.wires.flatMap((w): (Wire | unknown)[] => {
        if (!isWireV1(w)) {
          return [w];
        }
        const from = comps.get(w.from.comp);
        const to = comps.get(w.to.comp);
        if (!from || !to) {
          return [];
        }
        const fromPorts = portsOf(from, lookup);
        const toPorts = portsOf(to, lookup);
        if (w.from.pin >= fromPorts.outputs.length || w.to.pin >= toPorts.inputs.length) {
          return [];
        }
        const points = routeV1(
          outputPinPos(from, fromPorts, w.from.pin),
          w.points ?? [],
          inputPinPos(to, toPorts, w.to.pin),
        );
        // 両端が同じ点になる配線 (出力ピンと入力ピンが重なっている) は、点が 1 つになるので捨てる
        return points.length >= 2 ? [{ id: w.id, points }] : [];
      });
      return { ...d, wires };
    }),
  };
}
