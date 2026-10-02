// パレットからシートへ部品をドラッグするときの受け渡し
import type { ComponentKind } from '../circuit/component';

/** パレットからシートへドラッグするときの dataTransfer の型 */
export const DRAG_MIME = 'application/x-sazanka-part';

export interface PaletteDrag {
  kind: ComponentKind;
  custom?: string;
}
