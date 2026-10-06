import type { Component, ComponentKind } from '../circuit/component';
import { bodySize, type SheetPin, sheetPinsOf } from '../geometry/layout';
import type { Ports } from '../circuit/module';
import type { PartLayout } from '../parts/layout';
import { layoutOf } from '../parts/layouts';
import { partSpecOf } from '../parts/specs';
import { classNames } from '../ui/classNames';
import styles from './ComponentView.module.css';
import { labelOf, partViewOf } from '../parts/views';

/** シート上の部品の中に書く名前 */
function bodyLabelOf(kind: ComponentKind): string {
  return partViewOf(kind)?.bodyLabel ?? labelOf(kind);
}

/** 本体の輪郭。形は部品の種類の配置 (parts/layouts.ts) の body で決まる */
function BodyOutline({
  body,
  x,
  y,
  w,
  h,
}: {
  body: PartLayout['body'];
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  switch (body) {
    case 'rect':
      return <rect className={styles.body} x={x} y={y} width={w} height={h} />;
    case 'rounded':
      return <rect className={styles.body} x={x} y={y} width={w} height={h} rx={4} />;
    case 'circle':
      return <circle className={styles.body} cx={x + w / 2} cy={y + h / 2} r={w / 2} />;
  }
}

/** ピンの線と先端の丸。線は左か上の端から、右か下の端へ引く */
function PinLead({ pin, on }: { pin: SheetPin; on: boolean | undefined }) {
  const [from, to] =
    pin.side === 'left' || pin.side === 'top' ? [pin.tip, pin.base] : [pin.base, pin.tip];
  return (
    <g>
      <line
        className={classNames(styles.lead, on && styles.on)}
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
      />
      <circle className={styles.pin} cx={pin.tip.x} cy={pin.tip.y} r={6} />
    </g>
  );
}

/** 本体の内側の、ピンの根元のそばに書くピン名。名前のないピンには書かない */
function PinName({ pin, label }: { pin: SheetPin; label: string }) {
  if (!label) {
    return null;
  }
  switch (pin.side) {
    case 'left':
      return (
        <text className={styles.pinLabel} x={pin.base.x + 4} y={pin.base.y + 4}>
          {label}
        </text>
      );
    case 'right':
      return (
        <text
          className={classNames(styles.pinLabel, styles.end)}
          x={pin.base.x - 4}
          y={pin.base.y + 4}
        >
          {label}
        </text>
      );
    case 'top':
    case 'bottom':
      // 上下の辺のピン名は、まだ書かない (上下にピンを置く配置がない)
      return null;
  }
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
  const pins = sheetPinsOf(c, ports);
  const outline = <BodyOutline body={layoutOf(c.kind, ports).body} x={c.x} y={c.y} w={w} h={h} />;
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
        {outline}
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
        {outline}
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
        {outline}
        <text className={styles.terminalMark} x={c.x + w / 2} y={c.y + h / 2 + 6}>
          {bodyLabelOf(c.kind)}
        </text>
      </>
    );
  } else if (c.kind === 'OUTPUT') {
    body = (
      <>
        {outline}
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
        {outline}
        <text className={styles.label} x={c.x + w / 2} y={isCustom ? c.y - 6 : c.y + h / 2 + 4}>
          {isCustom ? (name ?? '(不明)') : bodyLabelOf(c.kind)}
        </text>
        {ports.inputs.map((label, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: ピンは番号そのものが識別子 (PinRef.pin と同じ)
          <PinName key={i} pin={pins.inputs[i]} label={label} />
        ))}
        {ports.outputs.map((label, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: ピンは番号そのものが識別子 (PinRef.pin と同じ)
          <PinName key={i} pin={pins.outputs[i]} label={label} />
        ))}
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
      {inputValues.map((v, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: ピンは番号そのものが識別子 (PinRef.pin と同じ)
        <PinLead key={i} pin={pins.inputs[i]} on={v} />
      ))}
      {ports.outputs.map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: ピンは番号そのものが識別子 (PinRef.pin と同じ)
        <PinLead key={i} pin={pins.outputs[i]} on={outputValues[i]} />
      ))}
      {body}
    </g>
  );
}
