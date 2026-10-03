import type { Component } from '../circuit/component';
import { clockPeriodOf } from '../circuit/component';
import { partViewOf } from '../parts/views';

/** 何も操作していないときに順に表示するヒント */
const IDLE_HINTS = [
  '左のパネルからクリックかドラッグで部品を追加',
  'W (上の「配線」) で配線モード、V (上の「選択」) で選択モード。配線モードでは、クリックした点から点へ縦か横に配線を引ける',
  '配線の端をピンの先か、ほかの配線の上に置くとつながる。配線の途中どうしが交わるだけではつながらない',
  'INPUT はクリックで ON/OFF を切り替え',
  '1つのつながりに出力ピンを2つ以上つなぐと、値が決まらないエラーになる (赤い線)',
  '部品を動かしても配線はついてこない。つなぎ直すときは配線も動かす',
  '部品を右下の削除エリアへドラッグすると削除',
  '何もないところからドラッグすると範囲選択。選んだ部品と配線はまとめて動かしたり削除したりできる',
  'Shift+クリックで部品や配線を選択に追加・解除、Ctrl+A ですべて選択',
  'Ctrl+C でコピー、Ctrl+X で切り取り。Ctrl+V の後、クリックした位置に貼り付け',
  'ホイール (トラックパッドではピンチ) で拡大縮小。中ボタンか Space を押しながらドラッグすると表示を移動',
  'スマホでは2本指で表示を移動・拡大縮小',
  '右下のボタンで拡大縮小。□ のボタンで回路全体を表示、倍率を押すと等倍に戻る',
  'Ctrl+Z で元に戻す、Ctrl+Shift+Z (Ctrl+Y) でやり直し。INPUT の ON/OFF は元に戻す対象外',
  'フリップフロップ (D / T / JK) は、CLK (>) が OFF から ON になった瞬間だけ動く',
  'RS Latch はクロックがなく、S / R が変わるとすぐに Q が変わる',
  '部品には遅延がある。信号は 1 tick ずつ、時間をかけて伝わる',
  '「一時停止」してから「1 tick 進める」「1 tick 戻す」で、信号が伝わる様子を 1 tick ずつ行き来できる',
  'タブの「+」でモジュールを追加すると、回路を部品としてまとめられる',
  '「書き出し」でプロジェクト全体を JSON にしてコピーし、「読み込み」に貼り付けると同じ回路を開ける',
  'モジュールの中の INPUT / OUTPUT がピンになる。プロパティ欄でラベルを付けるとピン名になる',
];

/** モジュールのタブを開いているときに追加で表示するヒント */
const MODULE_HINTS = [
  'タブをダブルクリックすると、モジュールの名前を変更できる',
  'モジュールのタブはドラッグで並べ替えられる (メインは先頭に固定)',
  'このモジュールの INPUT / OUTPUT が、外側から見たピンになる。部品の上の #1, #2… がピンの番号',
  'INPUT / OUTPUT の上下の並びを変えるとピンの順番も変わり、外側の配線が別のピンにつながるので注意',
  'モジュールのタブを開いている間は、メイン回路のシミュレーションは止まる',
];

export interface HintContext {
  /** 部品をドラッグ中か。'trash' は削除エリアの上 */
  dragMode: 'none' | 'moving' | 'trash';
  /** 配線モードか */
  wireTool: boolean;
  /** 配線の途中 */
  wiring: boolean;
  /** 貼り付ける位置を選んでいる */
  placing: boolean;
  /** タブの名前を編集中 */
  editing: boolean;
  /** 配線だけを 1 本選んでいる */
  wireSelected: boolean;
  selectedComponent?: Component;
  /** 部品を2つ以上選んでいる */
  multipleSelected: boolean;
  unstable: boolean;
  /** 出力ピンが 2 つ以上つながったネットがある */
  conflict: boolean;
  /** モジュールのタブを開いている */
  inModule: boolean;
  /** 1 tick を進める間隔 (ms、環境設定)。CLOCK の周期の表示に使う */
  tickMs: number;
}

/** 今の操作に応じたヒント。複数あれば時間で切り替えて表示する */
export function statusHints(ctx: HintContext): string[] {
  if (ctx.dragMode === 'trash') {
    return ['離すと削除します'];
  }
  if (ctx.dragMode === 'moving') {
    return ['右下の削除エリアで離すと削除します'];
  }
  if (ctx.placing) {
    return ['クリックした位置に貼り付け ・ Esc で取り消し'];
  }
  if (ctx.wiring) {
    return [
      'クリックで折れる点を追加 ・ ピンか配線の上でつないで終了 ・ 最後の点をもう一度クリックで終了 ・ Esc で取り消し',
    ];
  }
  if (ctx.wireTool) {
    return [
      '配線モード: 何もないところ・ピン・配線の上をクリックして配線を開始 ・ V か Esc で選択モードに戻る',
    ];
  }
  if (ctx.editing) {
    return ['Enter で確定 ・ Esc で取り消し'];
  }
  if (ctx.wireSelected) {
    return ['Delete で配線を削除 ・ ドラッグで移動'];
  }
  if (ctx.multipleSelected) {
    return [
      'ドラッグでまとめて移動',
      'Delete か、右下の削除エリアへドラッグでまとめて削除',
      'Shift+クリックで選択に追加・解除',
      'Ctrl+C でコピー、Ctrl+X で切り取り',
    ];
  }
  const c = ctx.selectedComponent;
  if (c) {
    const move = ['ドラッグで移動', 'Delete か、右下の削除エリアへドラッグで削除'];
    // ヒントの文は、種類ごとの見せ方 (parts/) にある
    const own = partViewOf(c.kind)?.hints ?? [];
    const lines =
      typeof own === 'function' ? own({ period: clockPeriodOf(c), tickMs: ctx.tickMs }) : own;
    return [...lines, ...move];
  }
  if (ctx.unstable) {
    return ['発振中: 出力が自分の入力に戻るループで、値が決まらない状態になっている'];
  }
  if (ctx.conflict) {
    return [
      '赤い配線に出力ピンが2つ以上つながっていて、値が決まらない。つながる入力ピンは OFF になる',
    ];
  }
  return ctx.inModule ? [...MODULE_HINTS, ...IDLE_HINTS] : IDLE_HINTS;
}
