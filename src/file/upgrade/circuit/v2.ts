// 回路の形式 version 1 の回路 1 つを、version 2 の形に変える。読み込みの入口 (upgrade/index.ts の upgradeCircuit) から呼ぶ。
// version 2 では、NOT の本体を 3×4 マスから 3×2 マスにした (入力と出力のピンは、上から 2 マスめから 1 マスめになった)。
// 形式は docs/format/circuit/v1.md と docs/format/circuit/v2.md。
//
// 今のアプリのコード (部品の配置や検証) には頼らない。今のコードが変わっても、この変換の結果が変わらないようにするため

import { isObject } from '../../../util';

/**
 * version 1 の回路を version 2 の形にする。NOT の位置をずらして、ピンの先を元の場所に残す (配線は書き換えない)。
 * 向き (rotation) が 0 (省略) と 180 なら y を 1、90 と 270 なら x を 1 増やす。
 * 回路でないもの、位置や向きが正しくない NOT は、そのまま残す (このあとの検証で断る)
 */
export function upgradeToCircuitV2(circuit: unknown): unknown {
  if (!isObject(circuit)) {
    return circuit;
  }
  if (!Array.isArray(circuit.elements)) {
    return { ...circuit, version: 2 };
  }
  return { ...circuit, version: 2, elements: circuit.elements.map(shiftNot) };
}

/** NOT なら、ピンの先が元の場所に残るように位置をずらした要素。NOT でなければそのまま */
function shiftNot(element: unknown): unknown {
  if (!isObject(element) || element.kind !== 'not') {
    return element;
  }
  const { x, y } = element;
  if (typeof x !== 'number' || typeof y !== 'number') {
    return element;
  }
  // 回す前の本体は、version 1 が 3×4、version 2 が 3×2。ピンの先 (回す前の位置で y + 2) を同じ場所に残すには、
  // 回していなければ y を 1 増やす。回した向きでは、形式の文書の回したピンの先の式で同じになるように、x か y を 1 増やす
  switch (element.rotation ?? 0) {
    case 0:
    case 180:
      return { ...element, y: y + 1 };
    case 90:
    case 270:
      return { ...element, x: x + 1 };
    default:
      return element;
  }
}
