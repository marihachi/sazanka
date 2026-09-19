import type { Component } from '../engine/sim';
import { CLOCK_HALF_PERIOD } from './useClock';

/** 何も操作していないときに順に表示するヒント */
const IDLE_HINTS = [
  '左のパネルからクリックかドラッグで部品を追加',
  '出力ピン → 入力ピンの順にクリックで配線',
  '配線がつながった入力ピンをクリックすると配線を外す',
  'INPUT はクリックで ON/OFF を切り替え',
  '入力ピンにつなげる配線は1本だけ。別の配線をつなぐと置き換わる',
  '部品を左下の削除エリアへドラッグすると削除',
  'Ctrl+Z で元に戻す、Ctrl+Shift+Z (Ctrl+Y) でやり直し。INPUT の ON/OFF は元に戻す対象外',
  'フリップフロップ (D / T / JK) は、CLK (>) が OFF から ON になった瞬間だけ動く',
  'RS Latch はクロックがなく、S / R が変わるとすぐに Q が変わる',
  '「モジュールを追加」で回路を部品としてまとめられる',
  '「書き出し」でプロジェクト全体を JSON にしてコピーし、「読み込み」に貼り付けると同じ回路を開ける',
  'モジュールの中の INPUT / OUTPUT がピンになる。ダブルクリックでラベルを付けるとピン名になる',
];

/** モジュールのタブを開いているときに追加で表示するヒント */
const MODULE_HINTS = [
  'タブをダブルクリックすると、モジュールの名前を変更できる',
  'このモジュールの INPUT / OUTPUT が、外側から見たピンになる (上から順)',
  'INPUT / OUTPUT の上下の並びを変えるとピンの順番も変わり、外側の配線が別のピンにつながるので注意',
  'モジュールのタブを開いている間は、メイン回路のシミュレーションは止まる',
];

export interface HintContext {
  /** 部品をドラッグ中か。'trash' は削除エリアの上 */
  dragMode: 'none' | 'moving' | 'trash';
  /** 配線の途中 */
  wiring: boolean;
  /** 名前やラベルを編集中 */
  editing: boolean;
  wireSelected: boolean;
  selectedComponent?: Component;
  unstable: boolean;
  /** モジュールのタブを開いている */
  inModule: boolean;
}

/** 今の操作に応じたヒント。複数あれば時間で切り替えて表示する */
export function statusHints(ctx: HintContext): string[] {
  if (ctx.dragMode === 'trash') return ['離すと削除します'];
  if (ctx.dragMode === 'moving') return ['左下の削除エリアで離すと削除します'];
  if (ctx.wiring) return ['接続先の入力ピンをクリック ・ Esc で取り消し'];
  if (ctx.editing) return ['Enter で確定 ・ Esc で取り消し'];
  if (ctx.wireSelected) return ['Delete で配線を削除'];
  const c = ctx.selectedComponent;
  if (c) {
    const move = ['ドラッグで移動', 'Delete か、左下の削除エリアへドラッグで削除'];
    switch (c.kind) {
      case 'INPUT':
        return ['クリックで ON/OFF', 'ダブルクリックでラベルを編集', ...move];
      case 'OUTPUT':
        return ['ダブルクリックでラベルを編集', ...move];
      case 'CUSTOM':
        return ['ダブルクリックで中身を開く', 'ピンの並びは、中の INPUT / OUTPUT の上からの順', ...move];
      case 'CLOCK':
        return [`${(CLOCK_HALF_PERIOD * 2) / 1000} 秒周期で ON/OFF を繰り返す`, ...move];
      case 'RS':
        return [
          'S が ON で Q を ON、R が ON で Q を OFF にする (両方 ON なら OFF)',
          'クロックはなく、S / R が変わるとすぐに Q が変わる',
          ...move,
        ];
      case 'DFF':
        return ['CLK (>) が OFF→ON になった瞬間の D を Q に取り込む', ...move];
      case 'TFF':
        return ['CLK (>) が OFF→ON になった瞬間、T が ON なら Q を反転する', ...move];
      case 'JKFF':
        return ['CLK (>) が OFF→ON になった瞬間に、J で ON、K で OFF、両方で反転する', ...move];
      default:
        return move;
    }
  }
  if (ctx.unstable) return ['発振中: 出力が自分の入力に戻るループで、値が決まらない状態になっている'];
  return ctx.inModule ? [...MODULE_HINTS, ...IDLE_HINTS] : IDLE_HINTS;
}
