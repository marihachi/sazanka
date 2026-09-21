// 部品をコンポーネントをまたいで扱うための情報。パレット、シート、シート上の部品で共有する
import type { ComponentKind } from '../engine/component';

/** 部品の表示名 */
export const LABELS: Partial<Record<ComponentKind, string>> = {
  RS: 'RS Latch',
  RSEN: 'RS-EN Latch',
  DLATCH: 'D Latch',
  DFF: 'D-FF',
  TFF: 'T-FF',
  JKFF: 'JK-FF',
};

/** パレットからシートへドラッグするときの dataTransfer の型 */
export const DRAG_MIME = 'application/x-sazanka-part';

export interface PaletteDrag {
  kind: ComponentKind;
  custom?: string;
}
