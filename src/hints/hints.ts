// ステータスバーに出すヒントを、今の操作から選ぶ。文は言語ごとの文言の表 (i18n/) と、部品の種類の view.ts にある
import type { Part } from '../circuit/part';
import { clockPeriodOf, clockPeriodSeconds } from '../circuit/part';
import { partViewOf } from '../parts/views';
import type { PortProblem } from '../circuit/module';
import type { Language } from '../i18n/language';
import { getMessages } from '../i18n/messages';

export interface HintContext {
  /** 部品をドラッグ中か。'trash' は削除エリアの上。'wireEnd' は配線の端のドラッグ中 */
  dragMode: 'none' | 'moving' | 'trash' | 'wireEnd';
  /** 配線モードか */
  wireTool: boolean;
  /** 分割モードか */
  splitTool: boolean;
  /** 配線の途中 */
  wiring: boolean;
  /** 貼り付ける位置を選んでいる */
  placing: boolean;
  /** タブの名前を編集中 */
  editing: boolean;
  /** 配線だけを 1 本選んでいる */
  wireSelected: boolean;
  selectedPart?: Part;
  /** 部品を2つ以上選んでいる */
  multipleSelected: boolean;
  unstable: boolean;
  /** 出力ピンが 2 つ以上つながったネットがある */
  conflict: boolean;
  /** メイン回路のタブを開いている。モジュールのタブ (タブの改名や並べ替え、split の並び順の注意など) のヒントを出さない */
  inMain: boolean;
  /** 開いている回路が、ピン番号で外側のピンを決める (パッケージが dip / qfp) */
  numberedModule: boolean;
  /** 選んでいる部品が、外側のピンに出せないポートなら、その理由 */
  selectedPortProblem?: PortProblem;
  /** 開いている回路に、外側のピンに出せないポートがある (メイン回路では警告しないので false) */
  unexposedPorts: boolean;
  /** 1 秒に進める tick 数 (環境設定)。CLOCK の周期を秒で示すのに使う */
  ticksPerSecond: number;
}

/** 今の操作に応じたヒント。複数あれば時間で切り替えて表示する。文は言語ごとの文言の表 (i18n/) にある */
export function statusHints(ctx: HintContext, lang: Language): string[] {
  const m = getMessages(lang).hints;
  if (ctx.dragMode === 'trash') {
    return [m.overTrash];
  }
  if (ctx.dragMode === 'moving') {
    return [m.dragging];
  }
  if (ctx.dragMode === 'wireEnd') {
    return [m.wireEndDragging];
  }
  if (ctx.placing) {
    return [m.placing];
  }
  if (ctx.wiring) {
    return [m.wiring];
  }
  if (ctx.wireTool) {
    return [m.wireTool];
  }
  if (ctx.splitTool) {
    return [m.splitTool];
  }
  if (ctx.editing) {
    return [m.editing];
  }
  if (ctx.wireSelected) {
    return [m.wireSelected];
  }
  if (ctx.multipleSelected) {
    return m.multipleSelected;
  }
  const c = ctx.selectedPart;
  if (c) {
    // ヒントの文は、種類ごとの見せ方 (parts/) にある
    const own = partViewOf(c.kind)?.hints?.[lang] ?? [];
    const lines =
      typeof own === 'function'
        ? own({
            period: clockPeriodOf(c),
            periodSeconds: clockPeriodSeconds(clockPeriodOf(c), ctx.ticksPerSecond),
          })
        : own;
    const problem = ctx.selectedPortProblem ? [m.portProblems[ctx.selectedPortProblem]] : [];
    return [...problem, ...lines, ...m.partSelected];
  }
  if (ctx.unstable) {
    return [m.unstable];
  }
  if (ctx.conflict) {
    return [m.conflict];
  }
  if (ctx.unexposedPorts) {
    return [m.unexposedPorts];
  }
  // 回路設定とピン番号の割り当ては、メイン回路でも使える。split の並び順の注意は外側の配線のことなので、モジュールだけ
  const own = ctx.numberedModule ? m.numberedModule : ctx.inMain ? [] : m.splitModule;
  const moduleOnly = ctx.inMain ? [] : m.module;
  return [...moduleOnly, m.circuitSettings, ...own, ...m.idle];
}
