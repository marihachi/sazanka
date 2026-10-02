// 部品の種類の、画面での見せ方 (表示名、アイコン、パレットでの置き場所、説明、ヒント) の書き方。
// 種類ごとの見せ方は、このフォルダに engine/parts/ と同じ名前のファイルで置き、index.ts の PART_VIEWS に並べる

/**
 * パレットのグループの ID。折り畳みの状態の保存に使うので、一度決めたら変えない。
 * 見出しの文字とグループの並びは Palette.tsx の GROUPS
 */
export type PaletteGroupId = 'io' | 'source' | 'gate' | 'latch' | 'flipflop';

export interface PartView {
  /** 表示名 (パレット、プロパティ欄、シート上の部品) */
  label: string;
  /**
   * シート上の部品の中に書く名前。なければ label。
   * 本体の幅に収まらないものだけ短くする。形が端子の部品では、本体の中に大きく書く記号
   */
  bodyLabel?: string;
  /** アイコン (src/assets/icons/ の SVG。描き方は docs/agent/icons.md) */
  icon: string;
  /** パレットのどのグループに出すか。グループの中では PART_VIEWS の順に並ぶ */
  group: PaletteGroupId;
  /** パレットのツールチップ。部品の働きを1文で説明する */
  description: string;
  /** 選んでいる間にステータスバーに出すヒント。移動・削除の案内は後ろに自動で付く */
  hints?: string[];
}
