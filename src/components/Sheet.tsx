import { useEffect, useMemo, useRef, useState } from 'react';
import { bodySize, clampPosition, GRID, inputPinPos, outputPinPos, Point, snap } from '../engine/layout';
import type { Component, PinRef, ComponentKind } from '../engine/circuit';
import { portsOf, findDef, type CircuitDef, type Project } from '../engine/project';
import { pinKey, type SimResult } from '../engine/sim';
import { ComponentView } from './ComponentView';
import { classNames } from './classNames';
import { InlineInput } from './Dialogs';
import { DRAG_MIME, type PaletteDrag } from './drag';
import styles from './Sheet.module.css';

export type Selection = { type: 'comp' | 'wire'; id: string } | null;
/** 部品をドラッグ中か。'trash' は削除エリアの上 (離すと削除) */
export type DragMode = 'none' | 'moving' | 'trash';

export interface SheetSize {
  width: number;
  height: number;
}

interface Drag {
  id: string;
  offset: Point;
  moved: boolean;
  /** このドラッグで onMoveStart を呼んだか */
  started: boolean;
  pointerId: number;
  /** 押した位置 (クライアント座標) */
  start: Point;
}

/** 押した位置からこれ以上動いたらドラッグとみなす (px) */
const DRAG_THRESHOLD = 4;

function wirePath(a: Point, b: Point): string {
  const mid = snap((a.x + b.x) / 2);
  return `M${a.x},${a.y} H${mid} V${b.y} H${b.x}`;
}

interface SheetProps {
  project: Project;
  circuit: CircuitDef;
  sim: SimResult;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  /** 配線の途中で、接続元の出力ピン */
  pending: PinRef | null;
  onPendingChange: (pending: PinRef | null) => void;
  dragMode: DragMode;
  onDragModeChange: (mode: DragMode) => void;
  /** ラベルを編集中の部品 */
  labelEditingId?: string;
  /** 部品をここにドロップすると削除する要素 */
  trashRef: React.RefObject<HTMLElement | null>;
  onResize: (size: SheetSize) => void;
  /** パレットから部品がドロップされた */
  onAdd: (kind: ComponentKind, custom: string | undefined, at: Point) => void;
  /** 部品のドラッグで最初に位置が変わる直前。ドラッグ全体を1回の操作にするために使う */
  onMoveStart: () => void;
  onMove: (id: string, position: Point) => void;
  /** 削除エリアで離された。moved はそれまでに位置を動かしたか */
  onDropOnTrash: (id: string, moved: boolean) => void;
  /** INPUT が (ドラッグせずに) クリックされた */
  onToggle: (id: string) => void;
  onConnect: (from: PinRef, to: PinRef) => void;
  /** 入力ピンにつながった配線を外す */
  onDisconnect: (to: PinRef) => void;
  onComponentDoubleClick: (c: Component) => void;
  onLabelCommit: (id: string, value: string) => void;
  onLabelCancel: () => void;
}

/** 回路を描き、部品のドラッグ・配線・パレットからのドロップを受け付けるシート */
export function Sheet({
  project,
  circuit,
  sim,
  selection,
  onSelect,
  pending,
  onPendingChange,
  dragMode,
  onDragModeChange,
  labelEditingId,
  trashRef,
  onResize,
  onAdd,
  onMoveStart,
  onMove,
  onDropOnTrash,
  onToggle,
  onConnect,
  onDisconnect,
  onComponentDoubleClick,
  onLabelCommit,
  onLabelCancel,
}: SheetProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [mouse, setMouse] = useState<Point>({ x: 0, y: 0 });
  const compMap = useMemo(() => new Map(circuit.components.map((c) => [c.id, c])), [circuit]);
  /** 入力ピン (pinKey) → つながっている配線 */
  const wireTo = useMemo(() => new Map(circuit.wires.map((w) => [pinKey(w.to.comp, w.to.pin), w])), [circuit]);

  // 部品を追加するときにはみ出さない位置へ置けるよう、大きさを知らせる
  useEffect(() => {
    const svg = svgRef.current!;
    const observer = new ResizeObserver(() => {
      const rect = svg.getBoundingClientRect();
      onResize({ width: rect.width, height: rect.height });
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, [onResize]);

  function toLocal(e: { clientX: number; clientY: number }): Point {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onCompPointerDown(e: React.PointerEvent, c: Component) {
    e.stopPropagation();
    const p = toLocal(e);
    dragRef.current = {
      id: c.id,
      offset: { x: p.x - c.x, y: p.y - c.y },
      moved: false,
      started: false,
      pointerId: e.pointerId,
      start: { x: e.clientX, y: e.clientY },
    };
    onSelect({ type: 'comp', id: c.id });
  }

  function onPointerMove(e: React.PointerEvent) {
    const p = toLocal(e);
    setMouse(p);
    const drag = dragRef.current;
    if (!drag) return;
    const svg = svgRef.current!;
    if (!svg.hasPointerCapture(drag.pointerId)) {
      // 押しただけ・わずかに動いただけならクリック (ダブルクリック) として扱う
      if (Math.hypot(e.clientX - drag.start.x, e.clientY - drag.start.y) < DRAG_THRESHOLD) return;
      // シートの外 (削除エリアの上など) に出ても移動イベントを受け取り続ける。
      // 押した時点でキャプチャすると、クリックやダブルクリックが部品に届かなくなるため、ドラッグが始まってから行う
      svg.setPointerCapture(drag.pointerId);
    }
    const rect = trashRef.current?.getBoundingClientRect();
    const overTrash =
      !!rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (overTrash) {
      // 削除エリアの上では部品は動かさない
      drag.moved = true;
      onDragModeChange('trash');
      return;
    }
    if (drag.moved) onDragModeChange('moving');
    const c = compMap.get(drag.id);
    if (!c) return;
    const svgRect = svg.getBoundingClientRect();
    const pos = clampPosition(
      c,
      portsOf(c, project),
      { x: snap(p.x - drag.offset.x), y: snap(p.y - drag.offset.y) },
      svgRect.width,
      svgRect.height,
    );
    if (c.x === pos.x && c.y === pos.y) return;
    drag.moved = true;
    onDragModeChange('moving');
    if (!drag.started) {
      onMoveStart();
      drag.started = true;
    }
    onMove(drag.id, pos);
  }

  function onPointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    onDragModeChange('none');
    if (!drag) return;
    if (dragMode === 'trash') {
      onDropOnTrash(drag.id, drag.started);
      return;
    }
    // 動かさずに離したスイッチはトグル
    if (!drag.moved && compMap.get(drag.id)?.kind === 'INPUT') onToggle(drag.id);
  }

  function onInputPinDown(e: React.PointerEvent, c: Component, pin: number) {
    e.stopPropagation();
    const to = { comp: c.id, pin };
    if (pending) {
      onConnect(pending, to);
      onPendingChange(null);
    } else {
      // 入力ピンから始めた場合は既存の配線を外す
      onDisconnect(to);
    }
  }

  function onDrop(e: React.DragEvent) {
    const data = e.dataTransfer.getData(DRAG_MIME);
    if (!data) return;
    e.preventDefault();
    const { kind, custom } = JSON.parse(data) as PaletteDrag;
    const p = toLocal(e);
    // カーソルが部品の左上付近に来るよう少しずらす
    onAdd(kind, custom, { x: p.x - GRID, y: p.y - GRID });
  }

  /** ラベル入力欄は部品の真上に置く */
  function labelInputPosition(c: Component): React.CSSProperties {
    const { w } = bodySize(c, portsOf(c, project));
    const width = 120;
    return { left: Math.max(0, c.x + w / 2 - width / 2), top: Math.max(0, c.y - 30), width };
  }

  const pendingFrom = pending && compMap.get(pending.comp);
  const labelTarget = labelEditingId ? compMap.get(labelEditingId) : undefined;

  return (
    <div className={styles.sheetWrap}>
      <svg
        ref={svgRef}
        className={styles.sheet}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          dragRef.current = null;
          onDragModeChange('none');
        }}
        onPointerDown={() => {
          onPendingChange(null);
          onSelect(null);
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DRAG_MIME)) e.preventDefault();
        }}
        onDrop={onDrop}
      >
        <defs>
          <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
            <path d={`M${GRID},0 V${GRID} H0`} fill="none" stroke="var(--grid)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {circuit.wires.map((w) => {
          const from = compMap.get(w.from.comp);
          const to = compMap.get(w.to.comp);
          if (!from || !to) return null;
          const fromPorts = portsOf(from, project);
          const toPorts = portsOf(to, project);
          // モジュールのピンが減った場合など、存在しないピンへの配線は描かない
          if (w.from.pin >= fromPorts.outputs.length || w.to.pin >= toPorts.inputs.length) return null;
          const d = wirePath(outputPinPos(from, fromPorts, w.from.pin), inputPinPos(to, toPorts, w.to.pin));
          const on = sim.values.get(pinKey(w.from.comp, w.from.pin));
          const selected = selection?.type === 'wire' && selection.id === w.id;
          return (
            <g key={w.id}>
              <path className={classNames(styles.wire, on && styles.on, selected && styles.selected)} d={d} />
              <path
                className={styles.wireHit}
                d={d}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelect({ type: 'wire', id: w.id });
                }}
              />
            </g>
          );
        })}

        {circuit.components.map((c) => {
          const ports = portsOf(c, project);
          return (
            <ComponentView
              key={c.id}
              comp={c}
              ports={ports}
              name={c.kind === 'CUSTOM' ? findDef(project, c.custom)?.name : undefined}
              outputValues={Array.from(
                { length: Math.max(ports.outputs.length, 1) },
                (_, i) => !!sim.values.get(pinKey(c.id, i)),
              )}
              inputValues={ports.inputs.map((_, i) => {
                const w = wireTo.get(pinKey(c.id, i));
                return w ? !!sim.values.get(pinKey(w.from.comp, w.from.pin)) : false;
              })}
              selected={selection?.type === 'comp' && selection.id === c.id}
              onBodyDown={(e) => onCompPointerDown(e, c)}
              onBodyDoubleClick={() => onComponentDoubleClick(c)}
              onInputPinDown={(e, pin) => onInputPinDown(e, c, pin)}
              onOutputPinDown={(e, pin) => {
                e.stopPropagation();
                onPendingChange({ comp: c.id, pin });
              }}
            />
          );
        })}

        {pending && pendingFrom && (
          <path
            className={styles.pending}
            d={wirePath(outputPinPos(pendingFrom, portsOf(pendingFrom, project), pending.pin), mouse)}
          />
        )}
      </svg>
      {labelTarget && (
        <InlineInput
          key={labelTarget.id}
          className={styles.labelInput}
          style={labelInputPosition(labelTarget)}
          initial={labelTarget.label ?? ''}
          placeholder="ラベル"
          onCommit={(v) => onLabelCommit(labelTarget.id, v)}
          onCancel={onLabelCancel}
        />
      )}
    </div>
  );
}
