import type { Component } from '../circuit/component';
import { clockPeriodOf } from '../circuit/component';
import { partViewOf } from '../parts/views';

/** 何も操作していないときに順に表示するヒント */
const IDLE_HINTS = [
  '左のパネルからクリックかドラッグで部品を追加',
  '出力ピン → 入力ピンの順にクリックで配線',
  '配線がつながった入力ピンをクリックすると配線を外す',
  'INPUT はクリックで ON/OFF を切り替え',
  '入力ピンにつなげる配線は1本だけ。別の配線をつなぐと置き換わる',
  '部品を右下の削除エリアへドラッグすると削除',
  '何もないところからドラッグすると範囲選択。選んだ部品はまとめて動かしたり削除したりできる',
  'Shift+クリックで部品を選択に追加・解除、Ctrl+A ですべて選択',
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
  /** 配線の途中 */
  wiring: boolean;
  /** 貼り付ける位置を選んでいる */
  placing: boolean;
  /** タブの名前を編集中 */
  editing: boolean;
  wireSelected: boolean;
  selectedComponent?: Component;
  /** 部品を2つ以上選んでいる */
  multipleSelected: boolean;
  unstable: boolean;
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
      '接続先の入力ピンをクリック ・ 何もないところのクリックで折れる点を追加 ・ Esc で取り消し',
    ];
  }
  if (ctx.editing) {
    return ['Enter で確定 ・ Esc で取り消し'];
  }
  if (ctx.wireSelected) {
    return ['Delete で配線を削除 ・ 中央の縦線はドラッグで左右に動かせる'];
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
  return ctx.inModule ? [...MODULE_HINTS, ...IDLE_HINTS] : IDLE_HINTS;
}
