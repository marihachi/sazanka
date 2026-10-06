// パレットからシートへ部品をドラッグするときの受け渡し
import type { PartKind } from '../circuit/part';

/** パレットからシートへドラッグするときの dataTransfer の型 */
export const DRAG_MIME = 'application/x-sazanka-part';

export interface PaletteDrag {
  kind: PartKind;
  module?: string;
}
