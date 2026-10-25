// 部品の種類の、シート上での配置 (本体の大きさと輪郭、ピンの置き方) の書き方と、形ごとの既定の配置。
// 長さはすべてマス単位で書く。px に直してシート上の座標にするのは geometry/layout.ts。
// 既定と違う配置にする種類は、種類のフォルダ (output/ など) の layout.ts に置き、layouts.ts の PART_LAYOUTS に並べる

import type { Pinout } from '../circuit/module';

/** ピンが出る本体の辺 */
export type PinSide = 'left' | 'right' | 'top' | 'bottom';

/** ピンの置き方。ピンの先は、その辺から 1 マス外にある */
export interface PinPlacement {
  side: PinSide;
  /**
   * 辺の上の位置。左右の辺なら本体の上端から、上下の辺なら本体の左端から何マスめか。
   * ピンの先をグリッドに乗せるため整数にする
   */
  at: number;
  /** ピンの横に書く、外側のピン番号 (1 から)。dip / qfp のモジュールだけが持つ */
  number?: number;
}

export interface PartLayout {
  /** 本体の幅 (マス) */
  w: number;
  /** 本体の高さ (マス) */
  h: number;
  /** 本体の輪郭。rect は角を少しだけ丸めた四角、rounded は角を rect より丸めた四角、circle は幅を直径とする円 */
  body: 'rect' | 'rounded' | 'circle';
  /** 入力ピンの置き方。並び順がピン番号 */
  inputs: PinPlacement[];
  /** 出力ピンの置き方。並び順がピン番号 */
  outputs: PinPlacement[];
  /** 本体の上 1 マスに名前を書くか (モジュール)。部品の占める範囲に、その分を含める */
  nameAbove: boolean;
  /**
   * どのポートにもつながらないピン (NC) の置き方。線と「NC」の文字だけを描き、配線とはつながらない。
   * なければ NC のピンはない
   */
  nc?: PinPlacement[];
  /**
   * ピンの線に、入力か出力かを示す向きの印 (三角) を付けるか。
   * 辺から入力か出力かが分からない配置 (dip / qfp のモジュール) で付ける
   */
  directionMarks?: boolean;
}

/** 部品の向き。種類の配置から時計回りに回した角度 */
export type Rotation = 0 | 90 | 180 | 270;

export const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];

/**
 * 時計回りに 90 度回したときの辺。ピンの辺のほか、本体の上に書く名前 (nameAbove) が回った後の辺にも使う
 */
const TURNED_SIDE: Record<PinSide, PinSide> = {
  left: 'top',
  top: 'right',
  right: 'bottom',
  bottom: 'left',
};

/** 辺 side を rotation だけ時計回りに回した辺 */
export function rotateSide(side: PinSide, rotation: Rotation): PinSide {
  let s = side;
  for (let r = 0; r < rotation; r += 90) {
    s = TURNED_SIDE[s];
  }
  return s;
}

/**
 * 配置を rotation だけ時計回りに回す。本体の幅と高さ、ピンの辺と位置が変わる。
 * 本体の上に書く名前 (nameAbove) は、回す前の上の辺を指したまま残す。回した後の辺は rotateSide で求める
 */
export function rotateLayout(layout: PartLayout, rotation: Rotation): PartLayout {
  let l = layout;
  for (let r = 0; r < rotation; r += 90) {
    l = turnLayout(l);
  }
  return l;
}

/**
 * 配置を時計回りに 90 度回す。本体の中の点 (x, y) は (h − y, x) に移る (h は回す前の高さ)。
 * 例: 左の辺の位置 at の点 (0, at) は (h − at, 0) で、上の辺の位置 h − at になる
 */
function turnLayout(l: PartLayout): PartLayout {
  const turn = (p: PinPlacement): PinPlacement => ({
    ...p,
    side: TURNED_SIDE[p.side],
    // 上と下の辺へ移るピンは、左右の辺での上端からの位置が、右端からの位置になる
    at: p.side === 'left' || p.side === 'right' ? l.h - p.at : p.at,
  });
  return {
    ...l,
    w: l.h,
    h: l.w,
    inputs: l.inputs.map(turn),
    outputs: l.outputs.map(turn),
    ...(l.nc ? { nc: l.nc.map(turn) } : {}),
  };
}

/**
 * 種類の配置。部品のピンの割り当て (circuit/module.ts の getPinout) を受け取って配置を返す。
 * ピンの数と形はモジュールごとに違うので、部品ごとに渡す
 */
export type PartLayoutOf = (pinout: Pinout) => PartLayout;

/**
 * 論理ゲート (と、モジュールの展開でだけ作られる BUF)。幅 3、高さ 4 マス。
 * 1 入力 (BUF。NOT は not/layout.ts) は中央、2 入力は上下端から 1 マス内側。出力は中央
 */
export const gateLayout: PartLayoutOf = (pinout) => ({
  w: 3,
  h: 4,
  body: 'rect',
  inputs: pinout.inputs.map((_, i) => ({
    side: 'left',
    at: pinout.inputs.length === 1 ? 2 : i === 0 ? 1 : 3,
  })),
  outputs: pinout.outputs.map(() => ({ side: 'right', at: 2 })),
  // 本体の中には記号を描くので、名前は上に書く (parts/GateSymbol.tsx)
  nameAbove: true,
});

/**
 * 記憶素子。幅 3、高さ 4 マス。
 * 入力は上から 1 マスおき (1, 2, 3 マスめ) で 3 本まで。Q と Q̄ は上下端から 1 マス内側 (1 と 3 マスめ)
 */
export const flipflopLayout: PartLayoutOf = (pinout) => ({
  w: 3,
  h: 4,
  body: 'rect',
  inputs: pinout.inputs.map((_, i) => ({ side: 'left', at: i + 1 })),
  outputs: pinout.outputs.map((_, i) => ({ side: 'right', at: i === 0 ? 1 : 3 })),
  nameAbove: false,
});

/** 小さな四角 (INPUT、OUTPUT、CLOCK、HIGH)。2 マス四方の角の丸い四角で、ピンは中央 */
export const squareLayout: PartLayoutOf = (pinout) => ({
  w: 2,
  h: 2,
  body: 'rounded',
  inputs: pinout.inputs.map(() => ({ side: 'left', at: 1 })),
  outputs: pinout.outputs.map(() => ({ side: 'right', at: 1 })),
  nameAbove: false,
});
