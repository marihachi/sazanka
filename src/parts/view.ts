// 部品の種類の、画面での見せ方 (表示名、アイコン、パレットでの置き場所、説明、ヒント) の書き方。
// 種類ごとの見せ方は、種類のフォルダ (and/ など) の view.ts に置き、views.ts の PART_VIEWS に並べる

/**
 * パレットのグループの ID。折り畳みの状態の保存に使うので、一度決めたら変えない。
 * 見出しの文字とグループの並びは Palette.tsx の GROUPS
 */
export type PaletteGroupId = 'io' | 'source' | 'gate' | 'latch' | 'flipflop' | 'device';

/** ヒントを部品の設定に合わせて作るときに渡すもの */
export interface HintContext {
  /** CLOCK の周期 (tick 数) */
  period: number;
  /** 1 tick を進める間隔 (ms、環境設定) */
  tickMs: number;
}

export interface PartView {
  /** 表示名 (パレット、プロパティ欄、シート上の部品) */
  label: string;
  /**
   * シート上の部品の中に書く名前。なければ label。
   * 本体の幅に収まらないものだけ短くする。HIGH では、本体の中に大きく書く記号
   */
  bodyLabel?: string;
  /** アイコン (同じ種類のフォルダの icon.svg。描き方は docs/agent/icons.md) */
  icon: string;
  /**
   * パレットのどのグループに出すか。グループの中では PART_VIEWS の順に並ぶ。
   * なければパレットに種類としては出さない (モジュールは、モジュールごとに出す)
   */
  group?: PaletteGroupId;
  /** パレットのツールチップ。部品の働きを1文で説明する */
  description: string;
  /** 選んでいる間にステータスバーに出すヒント。移動・削除の案内は後ろに自動で付く */
  hints?: string[] | ((ctx: HintContext) => string[]);
}
