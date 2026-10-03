import type { Component, ComponentKind } from '../circuit/component';
import { bodySize, inputPinPos, outputPinPos } from '../geometry/layout';
import type { Ports } from '../circuit/module';
import { partSpecOf } from '../parts/specs';
import { classNames } from '../ui/classNames';
import styles from './ComponentView.module.css';
import { labelOf, partViewOf } from '../parts/views';

/** シート上の部品の中に書く名前 */
function bodyLabelOf(kind: ComponentKind): string {
  return partViewOf(kind)?.bodyLabel ?? labelOf(kind);
}

interface ComponentViewProps {
  comp: Component;
  ports: Ports;
  /** CUSTOM の表示名 */
  name?: string;
  /** 出力ピンの値 (OUTPUT は表示する入力値) */
  outputValues: boolean[];
  inputValues: boolean[];
  selected: boolean;
  /** モジュールの中の INPUT / OUTPUT のとき、外から見たピンの番号 (1 から)。部品の上に表示する */
  pinNumber?: number;
  onBodyDown: (e: React.PointerEvent) => void;
  onBodyDoubleClick: () => void;
}

export function ComponentView({
  comp: c,
  ports,
  name,
  outputValues,
  inputValues,
  selected,
  pinNumber,
  onBodyDown,
  onBodyDoubleClick,
}: ComponentViewProps) {
  const { w, h } = bodySize(c, ports);
  const value = outputValues[0];
  const numberBadge = pinNumber !== undefined && (
    <text className={styles.pinNumber} x={c.x + w / 2} y={c.y - 6}>
      #{pinNumber}
    </text>
  );
  const lamp = value ? 'var(--chakra-colors-sheet-on)' : '#333';

  // 文字の y はベースライン (文字の下端) なので、縦の中央に見せたいときは、文字の高さの半分ほど (+4 など) 下げる
  let body: React.ReactNode;
  if (c.kind === 'INPUT') {
    body = (
      <>
        <rect className={styles.body} x={c.x} y={c.y} width={w} height={h} rx={4} />
        <rect
          x={c.x + 8}
          y={c.y + 8}
          width={w - 16}
          height={h - 16}
          rx={3}
          fill={lamp}
          pointerEvents="none"
        />
        {c.label && (
          <text className={classNames(styles.pinLabel, styles.end)} x={c.x - 6} y={c.y + h / 2 + 4}>
            {c.label}
          </text>
        )}
        {numberBadge}
      </>
    );
  } else if (c.kind === 'CLOCK') {
    const y0 = c.y + h / 2;
    body = (
      <>
        <rect className={styles.body} x={c.x} y={c.y} width={w} height={h} rx={4} />
        {/* 矩形波の絵。本体の左から 6px、中央より 7px 下から始め、幅 7px・高さ 14px の段を描く
            (h は横、v は縦への相対的な移動。v が負なら上へ) */}
        <path
          d={`M${c.x + 6},${y0 + 7} h7 v-14 h7 v14 h7 v-14 h7`}
          fill="none"
          stroke={value ? 'var(--chakra-colors-sheet-on)' : 'var(--chakra-colors-sheet-line)'}
          strokeWidth={2}
          pointerEvents="none"
        />
      </>
    );
  } else if (partSpecOf(c.kind)?.shape === 'terminal') {
    // 形が端子の部品 (HIGH など)。本体の中に記号を大きく書く
    body = (
      <>
        <rect className={styles.body} x={c.x} y={c.y} width={w} height={h} rx={4} />
        <text className={styles.terminalMark} x={c.x + w / 2} y={c.y + h / 2 + 6}>
          {bodyLabelOf(c.kind)}
        </text>
      </>
    );
  } else if (c.kind === 'OUTPUT') {
    body = (
      <>
        <circle className={styles.body} cx={c.x + w / 2} cy={c.y + h / 2} r={w / 2} />
        <circle cx={c.x + w / 2} cy={c.y + h / 2} r={w / 2 - 6} fill={lamp} pointerEvents="none" />
        {c.label && (
          <text className={styles.pinLabel} x={c.x + w + 6} y={c.y + h / 2 + 4}>
            {c.label}
          </text>
        )}
        {numberBadge}
      </>
    );
  } else {
    const isCustom = c.kind === 'CUSTOM';
    body = (
      <>
        <rect className={styles.body} x={c.x} y={c.y} width={w} height={h} />
        <text className={styles.label} x={c.x + w / 2} y={isCustom ? c.y - 6 : c.y + h / 2 + 4}>
          {isCustom ? (name ?? '(不明)') : bodyLabelOf(c.kind)}
        </text>
        {ports.inputs.map((label, i) =>
          label ? (
            <text
              // biome-ignore lint/suspicious/noArrayIndexKey: ピンは番号そのものが識別子 (PinRef.pin と同じ)
              key={i}
              className={styles.pinLabel}
              x={c.x + 4}
              y={inputPinPos(c, ports, i).y + 4}
            >
              {label}
            </text>
          ) : null,
        )}
        {ports.outputs.map((label, i) =>
          label ? (
            <text
              // biome-ignore lint/suspicious/noArrayIndexKey: ピンは番号そのものが識別子 (PinRef.pin と同じ)
              key={i}
              className={classNames(styles.pinLabel, styles.end)}
              x={c.x + w - 4}
              y={outputPinPos(c, ports, i).y + 4}
            >
              {label}
            </text>
          ) : null,
        )}
      </>
    );
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: シートはマウスとタッチで操作する描画面で、キーボードでの操作は用意していない
    <g
      className={selected ? styles.selected : undefined}
      onPointerDown={onBodyDown}
      onDoubleClick={onBodyDoubleClick}
      style={{ cursor: 'move' }}
    >
      {inputValues.map((v, i) => {
        const p = inputPinPos(c, ports, i);
        return (
          <g
            // biome-ignore lint/suspicious/noArrayIndexKey: ピンは番号そのものが識別子 (PinRef.pin と同じ)
            key={i}
          >
            {/* ピンの丸から本体の左端までの線 */}
            <line
              className={classNames(styles.lead, v && styles.on)}
              x1={p.x}
              y1={p.y}
              x2={c.x}
              y2={p.y}
            />
            <circle className={styles.pin} cx={p.x} cy={p.y} r={6} />
          </g>
        );
      })}
      {ports.outputs.map((_, i) => {
        const p = outputPinPos(c, ports, i);
        return (
          <g
            // biome-ignore lint/suspicious/noArrayIndexKey: ピンは番号そのものが識別子 (PinRef.pin と同じ)
            key={i}
          >
            {/* 本体の右端からピンの丸までの線 */}
            <line
              className={classNames(styles.lead, outputValues[i] && styles.on)}
              x1={c.x + w}
              y1={p.y}
              x2={p.x}
              y2={p.y}
            />
            <circle className={styles.pin} cx={p.x} cy={p.y} r={6} />
          </g>
        );
      })}
      {body}
    </g>
  );
}
