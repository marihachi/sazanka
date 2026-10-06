// テスト用の回路の作り方 (sim.test.ts と simDetail.test.ts で使う)。アプリからは使わない

import type { Part } from '../circuit/part';
import { pinoutOf } from '../circuit/module';
import type { CircuitDef, Project } from '../circuit/project';
import { inputPinPos, outputPinPos } from '../geometry/layout';
import { mustGet } from '../util';
import type { Link } from './sim';

/** 出力ピン from から入力ピン to へのつながり */
export function link(from: string, fromPin: number, to: string, toPin: number): Link {
  return { from: { comp: from, pin: fromPin }, to: { comp: to, pin: toPin } };
}

/**
 * 部品と、つなぎたいピンの組 (links) から、配線を引いた回路を作る。
 * 部品は、並べた順に右下へ 200 ずつずらして階段状に置く。モジュールのピンの順 (上から) も、並べた順になる。
 * 配線は、出力ピンの先と入力ピンの先を直線で結ぶ。計算はピンの先の位置でつながりを決めるだけなので、
 * アプリでは引けない斜めの線でも、つながりは同じになる。
 * 階段状に置くのは、ほかの部品のピンの先と同じ縦線・横線に並ばないようにして、
 * 配線の端がほかの配線の途中に乗る (意図しないつながりができる) のを避けるため
 */
export function wired(
  def: { id: string; name: string; parts: Part[]; links: Link[] },
  modules?: Project,
): CircuitDef {
  const parts = def.parts.map((c, i) => ({ ...c, x: i * 200, y: i * 200 }));
  const byId = new Map(parts.map((c) => [c.id, c]));
  // split のモジュールのピンの位置は番号だけで決まり、ピンの数によらない。そこで中身の回路は見ずに
  // (モジュールを含まない空のプロジェクトで引き)、モジュールには links で使う番号の分だけピンを置く。
  // modules を渡したときは、モジュールのピンをその中身の回路から決める (dip などのピン番号で置くモジュール)
  const none: Project = { circuits: [] };
  const used = (comp: string, side: 'from' | 'to') =>
    Math.max(0, ...def.links.filter((l) => l[side].comp === comp).map((l) => l[side].pin + 1));
  const pinsOf = (c: Part) =>
    c.kind === 'module' && !modules
      ? { inputs: Array(used(c.id, 'to')).fill(''), outputs: Array(used(c.id, 'from')).fill('') }
      : pinoutOf(c, modules ?? none);
  return {
    id: def.id,
    name: def.name,
    parts,
    wires: def.links.map(({ from, to }) => {
      const a = mustGet(byId, from.comp);
      const b = mustGet(byId, to.comp);
      return {
        id: `${from.comp}.${from.pin}-${to.comp}.${to.pin}`,
        points: [outputPinPos(a, pinsOf(a), from.pin), inputPinPos(b, pinsOf(b), to.pin)],
      };
    }),
  };
}
