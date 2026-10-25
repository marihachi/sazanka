import type { PartLayoutOf } from '../layout';

/** NOT。幅 3、高さ 2 マスで、入力と出力は上から 1 マスめ (ゲートの既定の配置より低くして、場所を取らないようにする) */
export const not: PartLayoutOf = (pinout) => ({
  w: 3,
  h: 2,
  body: 'rect',
  inputs: pinout.inputs.map(() => ({ side: 'left', at: 1 })),
  outputs: pinout.outputs.map(() => ({ side: 'right', at: 1 })),
  // 本体の中には記号を描くので、名前は上に書く (parts/GateSymbol.tsx)
  nameAbove: true,
});
