import type { ComponentKind } from '../engine/project';

/** パレットからシートへドラッグするときの dataTransfer の型 */
export const DRAG_MIME = 'application/x-sazanka-part';

export interface PaletteDrag {
  kind: ComponentKind;
  custom?: string;
}
