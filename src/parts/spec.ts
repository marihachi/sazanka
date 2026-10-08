// 部品の種類の仕様 (ピン、遅延、動作の分類と評価) の書き方と、仕様を書くときに使う共通の処理。
// 種類ごとの仕様は、このフォルダの種類のフォルダ (and/ など) の spec.ts に置き、specs.ts の PART_SPECS に並べる。
// 画面での見せ方 (表示名、アイコン、説明) は、同じ種類のフォルダの view.ts に置く (書き方は view.ts)。
// シート上の配置 (大きさ、輪郭、ピンの置き方) は layout.ts

/** 記憶素子の内部状態 */
export interface FlipFlopState {
  q: boolean;
  /**
   * 前回観測した CLK (立ち上がり検出用)。ラッチ (rsLatch、rsEnLatch、dLatch) は使わない。
   * 前回の結果がない (ページを開いた直後など) ときは OFF から始まるので、
   * その時点で CLK が ON なら、立ち上がりとみなして1回動く
   */
  clk: boolean;
}

interface PartSpecBase {
  kind: string;
  /**
   * 入力ピンの名前 (表示用)。名前のないピンは空文字。
   * 並び順がそのままピン番号になる。配線と保存データはピン番号で入力ピンを指すので、
   * 順番を入れ替えると、保存済みの回路の配線が別のピンにつながってしまう
   */
  inputs: readonly string[];
  /**
   * 遅延 (何 tick 後に出力へ現れるか)。NAND / NOR を 1 段として、実物の段数に近づける。
   * いちばん長い遅延を変えたら、simulation/sim.ts の SETTLED_TICKS も合わせる
   */
  delay: number;
}

/**
 * 入力から出力 (1 本) を決める部品 (ゲート、HIGH)。
 * 仕様には動作だけを書く。見た目 (配置) は layout.ts。種類の layout.ts がなければゲートの配置になる
 */
export interface LogicPartSpec extends PartSpecBase {
  behavior: 'logic';
  output: (ins: readonly boolean[]) => boolean;
}

/** 記憶素子 (ラッチとフリップフロップ)。出力は Q, Q̄ の 2 本。入力は 3 本まで。既定の配置は記憶素子の配置 */
export interface FlipFlopPartSpec extends PartSpecBase {
  behavior: 'flipFlop';
  /** 次の状態。ins は入力ピンの値 (ピン番号の順) */
  next: (ins: readonly boolean[], s: FlipFlopState) => FlipFlopState;
}

/**
 * 表示するだけの部品 (7 セグメントディスプレイなど)。入力ピンだけを持ち、出力ピンはない。
 * シミュレーションでは何も求めず、シートの描画が入力ピンの値を見て描く。見た目は種類の layout.ts と描き込みで決める
 */
export interface DisplayPartSpec extends PartSpecBase {
  behavior: 'display';
}

export type PartSpec = LogicPartSpec | FlipFlopPartSpec | DisplayPartSpec;

/** 仕様を定義する。種類の名前と動作の分類を文字列の型のまま残し、PartKind を PART_SPECS から導けるようにする */
export function definePart<const S extends PartSpec>(spec: S): S {
  return spec;
}

/** エッジトリガ型フリップフロップの CLK 入力のピン番号。JK も CLK を真ん中 (J, >, K) に置いてそろえている */
export const CLK_PIN = 1;

/** エッジトリガ型フリップフロップの次の状態。CLK の立ち上がりの瞬間だけ、q で Q を求め直す */
export function onRisingEdge(
  ins: readonly boolean[],
  s: FlipFlopState,
  q: () => boolean,
): FlipFlopState {
  const clk = ins[CLK_PIN];
  if (!clk || s.clk) {
    return { q: s.q, clk };
  }
  return { q: q(), clk };
}
