// テスト用の回路の作り方 (sim.test.ts と simDetail.test.ts で使う)。アプリからは使わない

import type { Component } from '../circuit/component';
import { portsOf } from '../circuit/module';
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
export function wired(def: {
  id: string;
  name: string;
  components: Component[];
  links: Link[];
}): CircuitDef {
  const components = def.components.map((c, i) => ({ ...c, x: i * 200, y: i * 200 }));
  const byId = new Map(components.map((c) => [c.id, c]));
  // モジュールのピンの位置は番号だけで決まり、ピンの数によらないので、モジュールを含まない空のプロジェクトで足りる
  const none: Project = { circuits: [] };
  return {
    id: def.id,
    name: def.name,
    components,
    wires: def.links.map(({ from, to }) => {
      const a = mustGet(byId, from.comp);
      const b = mustGet(byId, to.comp);
      return {
        id: `${from.comp}.${from.pin}-${to.comp}.${to.pin}`,
        points: [
          outputPinPos(a, portsOf(a, none), from.pin),
          inputPinPos(b, portsOf(b, none), to.pin),
        ],
      };
    }),
  };
}
