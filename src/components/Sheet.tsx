import { useEffect, useMemo, useRef, useState } from 'react';
import { bodySize, clampMove, GRID, inputPinPos, outputPinPos, Point, snap } from '../engine/layout';
import type { Component, ComponentKind } from '../engine/component';
import type { PinRef } from '../engine/circuit';
import { findDef, type CircuitDef, type Project } from '../engine/project';
import { portsOf } from '../engine/module';
import { pinKey, type SimResult } from '../engine/sim';
import { ComponentView } from './ComponentView';
import { classNames } from './classNames';
import { InlineInput } from './Dialogs';
import { DRAG_MIME, type PaletteDrag } from './parts';
import styles from './Sheet.module.css';

/** 部品は複数を同時に選べる (ids は空にしない)。配線は1本だけ */
export type Selection = { type: 'comp'; ids: string[] } | { type: 'wire'; id: string } | null;
/** 部品をドラッグ中か。'trash' は削除エリアの上 (離すと削除) */
export type DragMode = 'none' | 'moving' | 'trash';

export interface SheetSize {
  width: number;
  height: number;
}

interface Drag {
  /** 押した部品 */
  id: string;
  /** 押した位置と、押した部品の位置の差 */
  offset: Point;
  /** 一緒に動かす部品 (押した部品を含む) と、ドラッグ開始時の位置 */
  origins: Map<string, Point>;
  moved: boolean;
  /** このドラッグで onMoveStart を呼んだか */
  started: boolean;
  pointerId: number;
  /** 押した位置 (クライアント座標) */
  start: Point;
}

/** 範囲選択 */
interface Band {
  start: Point;
  end: Point;
  /** Shift を押して始めたときの、元の選択 (範囲内の部品を追加する) */
  base: string[];
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
  onMove: (positions: Map<string, Point>) => void;
  /** 削除エリアで離された。moved はそれまでに位置を動かしたか */
  onDropOnTrash: (ids: string[], moved: boolean) => void;
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
  const [band, setBand] = useState<Band | null>(null);
  const [mouse, setMouse] = useState<Point>({ x: 0, y: 0 });
  const compMap = useMemo(() => new Map(circuit.components.map((c) => [c.id, c])), [circuit]);
  /** 入力ピン (pinKey) → つながっている配線 */
  const wireTo = useMemo(() => new Map(circuit.wires.map((w) => [pinKey(w.to.comp, w.to.pin), w])), [circuit]);
  const selectedIds = useMemo(() => new Set(selection?.type === 'comp' ? selection.ids : []), [selection]);

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
    if (e.shiftKey) {
      // Shift+クリックは選択に追加・解除するだけで、ドラッグは始めない
      const ids = selectedIds.has(c.id) ? [...selectedIds].filter((id) => id !== c.id) : [...selectedIds, c.id];
      onSelect(ids.length > 0 ? { type: 'comp', ids } : null);
      return;
    }
    // 選択中の部品を押したら、選択中の部品をまとめて動かす
    const ids = selectedIds.has(c.id) ? [...selectedIds] : [c.id];
    const p = toLocal(e);
    dragRef.current = {
      id: c.id,
      offset: { x: p.x - c.x, y: p.y - c.y },
      origins: new Map(
        ids.flatMap((id) => {
          const o = compMap.get(id);
          return o ? [[id, { x: o.x, y: o.y }] as const] : [];
        }),
      ),
      moved: false,
      started: false,
      pointerId: e.pointerId,
      start: { x: e.clientX, y: e.clientY },
    };
    if (!selectedIds.has(c.id)) onSelect({ type: 'comp', ids });
  }

  /** 範囲に全体が収まる部品 */
  function componentsIn(a: Point, b: Point): string[] {
    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const bottom = Math.max(a.y, b.y);
    return circuit.components
      .filter((c) => {
        const { w, h } = bodySize(c, portsOf(c, project));
        return c.x >= left && c.y >= top && c.x + w <= right && c.y + h <= bottom;
      })
      .map((c) => c.id);
  }

  /** 何もないところを押したら、範囲選択を始める */
  function onBackgroundPointerDown(e: React.PointerEvent) {
    onPendingChange(null);
    const base = e.shiftKey && selection?.type === 'comp' ? selection.ids : [];
    onSelect(base.length > 0 ? { type: 'comp', ids: base } : null);
    const p = toLocal(e);
    svgRef.current!.setPointerCapture(e.pointerId);
    setBand({ start: p, end: p, base });
  }

  function onPointerMove(e: React.PointerEvent) {
    const p = toLocal(e);
    setMouse(p);
    if (band) {
      setBand({ ...band, end: p });
      const ids = [...new Set([...band.base, ...componentsIn(band.start, p)])];
      onSelect(ids.length > 0 ? { type: 'comp', ids } : null);
      return;
    }
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
    const anchor = drag.origins.get(drag.id)!;
    // ドラッグ開始時の位置からの移動量を、どの部品もはみ出さないように縮める
    const items = [...drag.origins].flatMap(([id, o]) => {
      const c = compMap.get(id);
      return c ? [{ c: { ...c, ...o }, ports: portsOf(c, project) }] : [];
    });
    const svgRect = svg.getBoundingClientRect();
    const d = clampMove(
      items,
      { x: snap(p.x - drag.offset.x) - anchor.x, y: snap(p.y - drag.offset.y) - anchor.y },
      svgRect.width,
      svgRect.height,
    );
    const positions = new Map(items.map(({ c }) => [c.id, { x: c.x + d.x, y: c.y + d.y }]));
    const unchanged = [...positions].every(([id, pos]) => {
      const c = compMap.get(id)!;
      return c.x === pos.x && c.y === pos.y;
    });
    if (unchanged) return;
    drag.moved = true;
    onDragModeChange('moving');
    if (!drag.started) {
      onMoveStart();
      drag.started = true;
    }
    onMove(positions);
  }

  function onPointerUp() {
    setBand(null);
    const drag = dragRef.current;
    dragRef.current = null;
    onDragModeChange('none');
    if (!drag) return;
    if (dragMode === 'trash') {
      onDropOnTrash([...drag.origins.keys()], drag.started);
      return;
    }
    if (drag.moved) return;
    // 動かさずに離したら、押した部品だけを選ぶ。スイッチはトグル
    onSelect({ type: 'comp', ids: [drag.id] });
    if (compMap.get(drag.id)?.kind === 'INPUT') onToggle(drag.id);
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
          setBand(null);
          onDragModeChange('none');
        }}
        onPointerDown={onBackgroundPointerDown}
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
              selected={selectedIds.has(c.id)}
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

        {band && (
          <rect
            className={styles.band}
            x={Math.min(band.start.x, band.end.x)}
            y={Math.min(band.start.y, band.end.y)}
            width={Math.abs(band.end.x - band.start.x)}
            height={Math.abs(band.end.y - band.start.y)}
          />
        )}

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
