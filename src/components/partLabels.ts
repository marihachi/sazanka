import type { ComponentKind } from '../engine/circuit';

/** 部品の表示名。パレットと、シート上の部品の両方で使う */
export const LABELS: Partial<Record<ComponentKind, string>> = {
  RS: 'RS Latch',
  DFF: 'D-FF',
  TFF: 'T-FF',
  JKFF: 'JK-FF',
};
