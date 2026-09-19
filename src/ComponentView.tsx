import { bodySize, inputPinPos, outputPinPos } from './geometry';
import type { Ports } from './project';
import { isFlipFlop, type Component, type Kind } from './sim';

export const LABELS: Partial<Record<Kind, string>> = { SR: 'SR', DFF: 'D-FF', TFF: 'T-FF', JKFF: 'JK-FF' };

interface ComponentViewProps {
  comp: Component;
  ports: Ports;
  /** SUB の表示名 */
  name?: string;
  /** 出力ピンの値 (OUTPUT は表示する入力値) */
  outputValues: boolean[];
  inputValues: boolean[];
  selected: boolean;
  onBodyDown: (e: React.PointerEvent) => void;
  onBodyDoubleClick: () => void;
  onInputPinDown: (e: React.PointerEvent, pin: number) => void;
  onOutputPinDown: (e: React.PointerEvent, pin: number) => void;
}

export function ComponentView({
  comp: c,
  ports,
  name,
  outputValues,
  inputValues,
  selected,
  onBodyDown,
  onBodyDoubleClick,
  onInputPinDown,
  onOutputPinDown,
}: ComponentViewProps) {
  const { w, h } = bodySize(c, ports);
  const value = outputValues[0];
  const lamp = value ? 'var(--on)' : '#333';

  let body: React.ReactNode;
  if (c.kind === 'INPUT') {
    body = (
      <>
        <rect className="body" x={c.x} y={c.y} width={w} height={h} rx={4} />
        <rect x={c.x + 8} y={c.y + 8} width={w - 16} height={h - 16} rx={3} fill={lamp} pointerEvents="none" />
        {c.label && (
          <text className="pin-label end" x={c.x - 6} y={c.y + h / 2 + 4}>
            {c.label}
          </text>
        )}
      </>
    );
  } else if (c.kind === 'CLOCK') {
    const y0 = c.y + h / 2;
    body = (
      <>
        <rect className="body" x={c.x} y={c.y} width={w} height={h} rx={4} />
        <path
          d={`M${c.x + 6},${y0 + 7} h7 v-14 h7 v14 h7 v-14 h7`}
          fill="none"
          stroke={value ? 'var(--on)' : 'var(--line)'}
          strokeWidth={2}
          pointerEvents="none"
        />
      </>
    );
  } else if (c.kind === 'OUTPUT') {
    body = (
      <>
        <circle className="body" cx={c.x + w / 2} cy={c.y + h / 2} r={w / 2} />
        <circle cx={c.x + w / 2} cy={c.y + h / 2} r={w / 2 - 6} fill={lamp} pointerEvents="none" />
        {c.label && (
          <text className="pin-label" x={c.x + w + 6} y={c.y + h / 2 + 4}>
            {c.label}
          </text>
        )}
      </>
    );
  } else {
    const isSub = c.kind === 'SUB';
    body = (
      <>
        <rect className="body" x={c.x} y={c.y} width={w} height={h} />
        <text
          className="label"
          x={c.x + w / 2}
          y={isSub ? c.y - 6 : isFlipFlop(c.kind) ? c.y + h / 2 + 4 : c.y + 20}
        >
          {isSub ? (name ?? '(不明)') : (LABELS[c.kind] ?? c.kind)}
        </text>
        {ports.inputs.map((label, i) =>
          label ? (
            <text key={i} className="pin-label" x={c.x + 4} y={inputPinPos(c, ports, i).y + 4}>
              {label}
            </text>
          ) : null,
        )}
        {ports.outputs.map((label, i) =>
          label ? (
            <text key={i} className="pin-label end" x={c.x + w - 4} y={outputPinPos(c, ports, i).y + 4}>
              {label}
            </text>
          ) : null,
        )}
      </>
    );
  }

  return (
    <g
      className={selected ? 'selected' : undefined}
      onPointerDown={onBodyDown}
      onDoubleClick={onBodyDoubleClick}
      style={{ cursor: 'move' }}
    >
      {inputValues.map((v, i) => {
        const p = inputPinPos(c, ports, i);
        return (
          <g key={i}>
            <line className={`lead${v ? ' on' : ''}`} x1={p.x} y1={p.y} x2={c.x} y2={p.y} />
            <circle className="pin" cx={p.x} cy={p.y} r={6} onPointerDown={(e) => onInputPinDown(e, i)} />
          </g>
        );
      })}
      {ports.outputs.map((_, i) => {
        const p = outputPinPos(c, ports, i);
        return (
          <g key={i}>
            <line className={`lead${outputValues[i] ? ' on' : ''}`} x1={c.x + w} y1={p.y} x2={p.x} y2={p.y} />
            <circle className="pin" cx={p.x} cy={p.y} r={6} onPointerDown={(e) => onOutputPinDown(e, i)} />
          </g>
        );
      })}
      {body}
    </g>
  );
}
