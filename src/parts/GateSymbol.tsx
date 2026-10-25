// ゲートの本体の中に描く記号 (MIL 記号)。短いリードを付けて、本体の真ん中に余白を取って描く。リードはピンにはつながない。
// 形と寸法は、開発者がモックで見て決めたもの (agent/plans/gate-symbols/plan.md の「記号の描き方」)
import type { GateSymbolSpec } from './view';

/** 否定の丸の半径 (px) */
const BUBBLE_R = 2.5;

/**
 * ゲートの記号。本体の左上を原点に、幅 w・高さ h (px。回していない向き) の本体の真ん中に描く。
 * 2 入力のゲートは本体の大きさから記号の大きさを決め、NOT は正三角形に近い決まった大きさにする
 */
export function GateSymbol({ symbol, w, h }: { symbol: GateSymbolSpec; w: number; h: number }) {
  const { gate, negated } = symbol;
  const two = gate !== 'not';
  // リードの長さ。XOR は左の弧の分だけ入力のリードを短くして、本体を長くする
  const leadIn = two ? (gate === 'xor' ? 7 : 9) : 6;
  const leadOut = 6;
  const r = negated ? BUBBLE_R : 0;
  // AND (と NAND) は、22px では横長に見えるので少し高くする (開発者がモックで見て決めた)
  const H = two ? Math.min(h - 18, gate === 'and' ? 24 : 22) : 18;
  // 本体の幅 (否定の丸を含む)
  const bodyW = two ? Math.min(w - 16, 44) - leadIn - leadOut : Math.round(H * 0.9) + 2 * BUBBLE_R;
  const total = bodyW + leadIn + leadOut;
  const x0 = (w - total) / 2 + leadIn;
  const y0 = (h - H) / 2;
  // 本体の右端 (否定の丸の手前)
  const end = x0 + bodyW - 2 * r;
  const wm = end - x0;
  const X = (f: number) => x0 + f * wm;
  const Y = (f: number) => y0 + f * H;
  // 入力のリードの高さ (記号の高さに対する割合)
  const fs = two ? [0.25, 0.75] : [0.5];

  let shape: string;
  let attach: number[];
  if (gate === 'not') {
    shape = `M${X(0)},${Y(0)} L${X(1)},${Y(0.5)} L${X(0)},${Y(1)} Z`;
    attach = [X(0)];
  } else if (gate === 'and') {
    shape = `M${X(0)},${Y(0)} H${X(0.5)} A${wm / 2},${H / 2} 0 0 1 ${X(0.5)},${Y(1)} H${X(0)} Z`;
    attach = fs.map(() => X(0));
  } else {
    // OR。XOR は本体を右に寄せ、左にもう 1 本の弧を描く
    const g = gate === 'xor' ? 0.2 : 0;
    const bw = (1 - g) * wm * 0.25;
    const mid = X(g + (1 - g) * 0.6);
    shape = `M${X(g)},${Y(0)} Q${X(g) + bw},${Y(0.5)} ${X(g)},${Y(1)} Q${mid},${Y(1)} ${X(1)},${Y(0.5)} Q${mid},${Y(0)} ${X(g)},${Y(0)} Z`;
    if (gate === 'xor') {
      shape += ` M${X(0)},${Y(0)} Q${X(0) + bw},${Y(0.5)} ${X(0)},${Y(1)}`;
    }
    // 入力のリードは、いちばん左の弧で止める (2 次ベジェの弧の、その高さでの x)
    attach = fs.map((f) => X(0) + 2 * bw * f * (1 - f));
  }
  if (negated) {
    shape += ` M${end + 2 * r},${Y(0.5)} A${r},${r} 0 1 1 ${end},${Y(0.5)} A${r},${r} 0 1 1 ${end + 2 * r},${Y(0.5)}`;
  }
  const leads = [
    ...fs.map((f, i) => `M${x0 - leadIn},${Y(f)} H${attach[i]}`),
    `M${x0 + bodyW},${Y(0.5)} H${x0 + bodyW + leadOut}`,
  ].join(' ');

  return (
    <g
      fill="none"
      // 名前の文字 (fg) より少し暗くして、記号を控えめにする (開発者が選んだ)
      stroke="var(--chakra-colors-gray-300)"
      strokeWidth={1.5}
      strokeLinejoin="round"
      pointerEvents="none"
    >
      <path d={shape} />
      <path d={leads} />
    </g>
  );
}
