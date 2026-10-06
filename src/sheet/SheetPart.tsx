import type { Part, PartKind } from '../circuit/part';
import { bodySize, type SheetPin, calcSheetPins } from '../geometry/layout';
import type { Pinout, PortProblem } from '../circuit/module';
import type { PartLayout } from '../parts/layout';
import { getLayout } from '../parts/layouts';
import { partSpecOf } from '../parts/specs';
import { classNames } from '../ui/classNames';
import styles from './SheetPart.module.css';
import { labelOf, partViewOf } from '../parts/views';

/** シート上の部品の中に書く名前 */
function bodyLabelOf(kind: PartKind): string {
  return partViewOf(kind)?.bodyLabel ?? labelOf(kind);
}

/**
 * 本体の輪郭。形は部品の種類の配置 (parts/layouts.ts) の body で決まる。
 * problem なら、外側のピンに出せないポートの印として赤い破線にする
 */
function BodyOutline({
  body,
  x,
  y,
  w,
  h,
  problem = false,
}: {
  body: PartLayout['body'];
  x: number;
  y: number;
  w: number;
  h: number;
  problem?: boolean;
}) {
  const className = classNames(styles.body, problem && styles.problem);
  switch (body) {
    case 'rect':
      return <rect className={className} x={x} y={y} width={w} height={h} />;
    case 'rounded':
      return <rect className={className} x={x} y={y} width={w} height={h} rx={4} />;
    case 'circle':
      return <circle className={className} cx={x + w / 2} cy={y + h / 2} r={w / 2} />;
  }
}

/**
 * ピンの線と先端の丸。線は左か上の端から、右か下の端へ引く。
 * direction があれば、線の中ほどに向きの印 (三角) を付ける。in は本体へ向き、out は外へ向く。
 * nc (どのポートにもつながらないピン) は、配線とつながらないので先端の丸を描かない
 */
function PinLead({
  pin,
  on,
  direction,
  nc = false,
}: {
  pin: SheetPin;
  on: boolean | undefined;
  direction?: 'in' | 'out';
  nc?: boolean;
}) {
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
      {direction && <DirectionMark pin={pin} direction={direction} on={on} />}
      {pin.number !== undefined && <OuterPinNumber pin={pin} />}
      {!nc && <circle className={styles.pin} cx={pin.tip.x} cy={pin.tip.y} r={6} />}
    </g>
  );
}

/**
 * ピンの線の中ほどに描く、向きの印 (三角)。
 * u は根元から先端へ向かう長さ 1 の向き、n はそれに直交する向き。
 * 三角の先は、線の中点から u の向き (out) か逆向き (in) に 3px、底辺はその反対側に 3px、幅は 8px。
 * 例: 左の辺の入力ピン (根元 (100, 120)、先端 (80, 120)) なら u = (-1, 0)、中点 (90, 120)、先は (93, 120)
 */
function DirectionMark({
  pin,
  direction,
  on,
}: {
  pin: SheetPin;
  direction: 'in' | 'out';
  on: boolean | undefined;
}) {
  const ux = Math.sign(pin.tip.x - pin.base.x);
  const uy = Math.sign(pin.tip.y - pin.base.y);
  const sign = direction === 'out' ? 1 : -1;
  const mx = (pin.base.x + pin.tip.x) / 2;
  const my = (pin.base.y + pin.tip.y) / 2;
  const apex = { x: mx + ux * 3 * sign, y: my + uy * 3 * sign };
  const back = { x: mx - ux * 3 * sign, y: my - uy * 3 * sign };
  // 直交する向き (uy, -ux) に 4px ずつ広げた 2 点が底辺
  const points = [
    `${apex.x},${apex.y}`,
    `${back.x + uy * 4},${back.y - ux * 4}`,
    `${back.x - uy * 4},${back.y + ux * 4}`,
  ].join(' ');
  return <polygon className={classNames(styles.direction, on && styles.on)} points={points} />;
}

/** ピンの線の上に書く、外側のピン番号 (dip / qfp のモジュール)。上下の辺のピンは線の右に書く */
function OuterPinNumber({ pin }: { pin: SheetPin }) {
  const mx = (pin.base.x + pin.tip.x) / 2;
  const my = (pin.base.y + pin.tip.y) / 2;
  const horizontal = pin.side === 'left' || pin.side === 'right';
  return (
    <text
      className={classNames(styles.outerNumber, !horizontal && styles.start)}
      x={horizontal ? mx : mx + 5}
      y={horizontal ? my - 6 : my + 3}
    >
      {pin.number}
    </text>
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

interface SheetPartProps {
  comp: Part;
  pinout: Pinout;
  /** モジュールの表示名 */
  name?: string;
  /** 出力ピンの値 (OUTPUT は表示する入力値) */
  outputValues: boolean[];
  inputValues: boolean[];
  selected: boolean;
  /** モジュールの中の INPUT / OUTPUT のとき、外から見たピンの番号 (1 から)。部品の上に表示する */
  pinNumber?: number;
  /** モジュールの中の INPUT / OUTPUT が、外側のピンに出せないとき、その理由。部品に印を付ける */
  portProblem?: PortProblem;
  onBodyDown: (e: React.PointerEvent) => void;
  onBodyDoubleClick: () => void;
}

export function SheetPart({
  comp: c,
  pinout,
  name,
  outputValues,
  inputValues,
  selected,
  pinNumber,
  portProblem,
  onBodyDown,
  onBodyDoubleClick,
}: SheetPartProps) {
  const { w, h } = bodySize(c, pinout);
  const pins = calcSheetPins(c, pinout);
  const outline = (
    <BodyOutline
      body={getLayout(c.kind, pinout).body}
      x={c.x}
      y={c.y}
      w={w}
      h={h}
      problem={portProblem !== undefined}
    />
  );
  const value = outputValues[0];
  // 外側のピンに出せないポートは、番号の代わりに印を出す (番号があれば添える)
  const numberBadge = portProblem ? (
    <text className={classNames(styles.pinNumber, styles.problem)} x={c.x + w / 2} y={c.y - 6}>
      #{c.pinNumber ?? ''}?
    </text>
  ) : (
    pinNumber !== undefined && (
      <text className={styles.pinNumber} x={c.x + w / 2} y={c.y - 6}>
        #{pinNumber}
      </text>
    )
  );
  const lamp = value ? 'var(--chakra-colors-sheet-on)' : '#333';

  // 文字の y はベースライン (文字の下端) なので、縦の中央に見せたいときは、文字の高さの半分ほど (+4 など) 下げる
  let body: React.ReactNode;
  if (c.kind === 'input') {
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
  } else if (c.kind === 'clock') {
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
  } else if (c.kind === 'output') {
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
    const isModule = c.kind === 'module';
    body = (
      <>
        {outline}
        <text className={styles.label} x={c.x + w / 2} y={isModule ? c.y - 6 : c.y + h / 2 + 4}>
          {isModule ? (name ?? '(不明)') : bodyLabelOf(c.kind)}
        </text>
        {pinout.inputs.map((label, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: ピンは番号そのものが識別子 (PinRef.pin と同じ)
          <PinName key={i} pin={pins.inputs[i]} label={label} />
        ))}
        {pinout.outputs.map((label, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: ピンは番号そのものが識別子 (PinRef.pin と同じ)
          <PinName key={i} pin={pins.outputs[i]} label={label} />
        ))}
        {pins.nc.map((p) => (
          <PinName key={`nc${p.number}`} pin={p} label="NC" />
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
        <PinLead
          // biome-ignore lint/suspicious/noArrayIndexKey: ピンは番号そのものが識別子 (PinRef.pin と同じ)
          key={i}
          pin={pins.inputs[i]}
          on={v}
          direction={pins.directionMarks ? 'in' : undefined}
        />
      ))}
      {pinout.outputs.map((_, i) => (
        <PinLead
          // biome-ignore lint/suspicious/noArrayIndexKey: ピンは番号そのものが識別子 (PinRef.pin と同じ)
          key={i}
          pin={pins.outputs[i]}
          on={outputValues[i]}
          direction={pins.directionMarks ? 'out' : undefined}
        />
      ))}
      {pins.nc.map((p) => (
        <PinLead key={`nc${p.number}`} pin={p} on={false} nc />
      ))}
      {body}
    </g>
  );
}
