import type { PartBodyProps } from '../bodies';

/** 光っているセグメントと、光っていないセグメントの色。光っている色は OUTPUT のランプと同じ */
const ON = 'var(--chakra-colors-sheet-on)';
const OFF = '#333';

/** ピンのある辺の内側に空ける幅 (px)。ピン名を書く場所 */
const PIN_NAME_SPACE = 18;
/** ピンのない辺の内側に空ける幅 (px) */
const PADDING = 10;

/**
 * 7 セグメントディスプレイの描き込み。入力ピン a〜g でセグメントを、DP で小数点を光らせる。
 * 数字の枠は、ピン名の場所を除いた本体の中に、幅と高さが 1 : 2 になるよう収めて真ん中に置く
 */
export function SevenSegmentBody({ w, h, layout, inputValues }: PartBodyProps) {
  const sides = new Set(layout.inputs.map((p) => p.side));
  const space = (side: 'left' | 'right' | 'top' | 'bottom') =>
    sides.has(side) ? PIN_NAME_SPACE : PADDING;
  const left = space('left');
  const top = space('top');
  const areaW = w - left - space('right');
  const areaH = h - top - space('bottom');
  // 小数点の分、右に少し空ける
  const dw = Math.min(areaW * 0.8, areaH / 2);
  const dh = dw * 2;
  const x0 = left + (areaW - dw * 1.15) / 2;
  const y0 = top + (areaH - dh) / 2;
  const t = dw * 0.18;
  const segments = calcSegments(x0, y0, dw, dh, t);
  const on = (i: number) => (inputValues[i] ? ON : OFF);
  return (
    <g pointerEvents="none">
      {segments.map((points, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: セグメントの並びはピン番号 (a〜g) そのもの
        <polygon key={i} points={points} fill={on(i)} />
      ))}
      <circle cx={x0 + dw + t * 1.2} cy={y0 + dh - t / 2} r={t / 2} fill={on(7)} />
    </g>
  );
}

/**
 * セグメント a〜g の形 (六角形の頂点の並び)。枠の左上 (x, y)、幅 dw、高さ dh、太さ t。
 * a は上、b は右上、c は右下、d は下、e は左下、f は左上、g は真ん中
 */
function calcSegments(x: number, y: number, dw: number, dh: number, t: number): string[] {
  const g = t * 0.15; // セグメントどうしのすき間
  const half = t / 2;
  const mid = y + dh / 2;
  /** 横のセグメント。中心の高さ cy */
  const horizontal = (cy: number) =>
    [
      [x + half + g, cy],
      [x + t + g, cy - half],
      [x + dw - t - g, cy - half],
      [x + dw - half - g, cy],
      [x + dw - t - g, cy + half],
      [x + t + g, cy + half],
    ]
      .map((p) => p.join(','))
      .join(' ');
  /** 縦のセグメント。中心の横位置 cx、上端 y1、下端 y2 */
  const vertical = (cx: number, y1: number, y2: number) =>
    [
      [cx, y1 + g],
      [cx + half, y1 + half + g],
      [cx + half, y2 - half - g],
      [cx, y2 - g],
      [cx - half, y2 - half - g],
      [cx - half, y1 + half + g],
    ]
      .map((p) => p.join(','))
      .join(' ');
  const lx = x + half;
  const rx = x + dw - half;
  return [
    horizontal(y + half),
    vertical(rx, y + half, mid),
    vertical(rx, mid, y + dh - half),
    horizontal(y + dh - half),
    vertical(lx, mid, y + dh - half),
    vertical(lx, y + half, mid),
    horizontal(mid),
  ];
}
