import { useEffect, useMemo, useRef, useState } from 'react';
import {
  bodySize,
  clampMove,
  componentBounds,
  GRID,
  inputPinPos,
  outputPinPos,
  Point,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  snap,
  wireRoute,
} from '../engine/layout';
import type { Component, ComponentKind } from '../engine/component';
import type { Circuit, PinRef } from '../engine/circuit';
import { findDef, MAIN_ID, type CircuitDef, type Project } from '../engine/project';
import { portComponents, portsOf } from '../engine/module';
import { pinKey, type SimResult } from '../engine/sim';
import { ComponentView } from './ComponentView';
import { classNames } from './classNames';
import { DRAG_MIME, type PaletteDrag } from './parts';
import styles from './Sheet.module.css';
import { overview, toScreen, toWorld, zoomAt, type View } from './view';
import { ZoomControls } from './ZoomControls';

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

/** 表示の移動 (中ボタンか Space を押しながらのドラッグ)。start は押した位置 (画面の座標) */
interface Pan {
  pointerId: number;
  start: Point;
  view: View;
}

/** 2本指での移動と拡大縮小。start は押した時点の、2本の指の中点と間隔 (画面の座標) */
interface Pinch {
  mid: Point;
  distance: number;
  view: View;
}

/** 配線の中央の縦線のドラッグ。start は押した位置 (クライアント座標) */
interface WireDrag {
  id: string;
  pointerId: number;
  start: Point;
  /** 出力ピンの先。縦線の位置は、この高さに置いた折れる点で表す */
  from: Point;
  started: boolean;
}

/**
 * 中間で1回折れる形の配線なら、その縦線の x 座標。
 * 折れる点がないか、出力ピンと同じ高さに1つだけある (縦線を動かした) 形が対象。縦線がない (両端が同じ高さ) ときは undefined
 */
function middleX(from: Point, points: readonly Point[], to: Point): number | undefined {
  if (from.y === to.y) return undefined;
  if (points.length === 0) return snap((from.x + to.x) / 2);
  if (points.length === 1 && points[0].y === from.y) return points[0].x;
  return undefined;
}

/** 押した位置からこれ以上動いたらドラッグとみなす (px) */
const DRAG_THRESHOLD = 4;

/** 拡大・縮小ボタン1回で変える倍率 */
const ZOOM_STEP = 1.25;

/** ポインターの位置を、シートの左上からの画面の座標にする */
function toScreenLocal(svg: SVGSVGElement, e: { clientX: number; clientY: number }): Point {
  const rect = svg.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** 配線の SVG のパス。折れる点の間を縦横の線でつなぐ (layout.ts の wireRoute) */
function wirePath(from: Point, points: readonly Point[], to: Point): string {
  return `M${wireRoute(from, points, to)
    .map((p) => `${p.x},${p.y}`)
    .join(' L')}`;
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
  /** 部品をここにドロップすると削除する要素 */
  trashRef: React.RefObject<HTMLElement | null>;
  onResize: (size: SheetSize) => void;
  /** 表示位置と倍率 (スクロールと拡大縮小) */
  view: View;
  onViewChange: (view: View) => void;
  /** 方眼を表示するか (環境設定) */
  showGrid: boolean;
  /** パレットから部品がドロップされた */
  onAdd: (kind: ComponentKind, custom: string | undefined, at: Point) => void;
  /** 部品のドラッグで最初に位置が変わる直前。ドラッグ全体を1回の操作にするために使う */
  onMoveStart: () => void;
  onMove: (positions: Map<string, Point>) => void;
  /** 配線の中央の縦線を左右に動かした。points は、その位置を表す折れる点 */
  onWirePointsChange: (id: string, points: Point[]) => void;
  /** 削除エリアで離された。moved はそれまでに位置を動かしたか */
  onDropOnTrash: (ids: string[], moved: boolean) => void;
  /** INPUT が (ドラッグせずに) クリックされた */
  onToggle: (id: string) => void;
  /** 配線した。points は途中で置いた折れる点 */
  onConnect: (from: PinRef, to: PinRef, points: Point[]) => void;
  /** 入力ピンにつながった配線を外す */
  onDisconnect: (to: PinRef) => void;
  onComponentDoubleClick: (c: Component) => void;
  /** 貼り付ける位置を選んでいる部品と配線 (コピー元の位置のまま)。ポインターについて動き、クリックで確定する */
  placing: Circuit | null;
  /** 貼り付ける位置が決まった。delta はコピー元の位置からのずれ */
  onPlace: (delta: Point) => void;
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
  trashRef,
  onResize,
  view,
  onViewChange,
  showGrid,
  onAdd,
  onMoveStart,
  onMove,
  onWirePointsChange,
  onDropOnTrash,
  onToggle,
  onConnect,
  onDisconnect,
  onComponentDoubleClick,
  placing,
  onPlace,
}: SheetProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const wireDragRef = useRef<WireDrag | null>(null);
  const [band, setBand] = useState<Band | null>(null);
  const [{ width, height }, setSize] = useState<SheetSize>({ width: 0, height: 0 });
  const panRef = useRef<Pan | null>(null);
  const pinchRef = useRef<Pinch | null>(null);
  /** シートに触れている指 (pointerId → 画面の座標)。2本になったら移動と拡大縮小にする */
  const touchesRef = useRef(new Map<number, Point>());
  /** Space を押している間は、ドラッグで表示を移動する */
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  /** ポインターの位置 (回路の座標)。配線中の線の先と、貼り付ける部品の位置に使う。シートの上に来るまでは null */
  const [mouse, setMouse] = useState<Point | null>(null);
  /** 配線の途中で置いた折れる点 (回路の座標) */
  const [pendingPoints, setPendingPoints] = useState<Point[]>([]);
  /** 貼り付けのために押した位置 (クライアント座標)。離したときに、動かしていなければ貼り付ける */
  const placeDownRef = useRef<{ pointerId: number; start: Point } | null>(null);
  const compMap = useMemo(() => new Map(circuit.components.map((c) => [c.id, c])), [circuit]);
  /** 入力ピン (pinKey) → つながっている配線 */
  const wireTo = useMemo(() => new Map(circuit.wires.map((w) => [pinKey(w.to.comp, w.to.pin), w])), [circuit]);
  const selectedIds = useMemo(() => new Set(selection?.type === 'comp' ? selection.ids : []), [selection]);
  /**
   * モジュールの中の INPUT / OUTPUT の、外から見たピンの番号 (部品 ID → 1 から)。INPUT と OUTPUT で別々に数える。
   * メイン回路はピンにならないので空
   */
  const pinNumbers = useMemo(() => {
    if (circuit.id === MAIN_ID) return new Map<string, number>();
    const { inputs, outputs } = portComponents(circuit);
    return new Map([...inputs, ...outputs].map((c) => [c.id, (c.kind === 'INPUT' ? inputs : outputs).indexOf(c) + 1]));
  }, [circuit]);

  // 部品を追加するとき、表示している範囲の真ん中に置けるよう、大きさを知らせる
  useEffect(() => {
    const svg = svgRef.current!;
    const observer = new ResizeObserver(() => {
      const rect = svg.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
      onResize({ width: rect.width, height: rect.height });
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, [onResize]);

  // ホイールの処理は一度だけ登録するので、呼び出し時点の最新の表示を ref から読む
  const viewRef = useRef(view);
  const onViewChangeRef = useRef(onViewChange);
  useEffect(() => {
    viewRef.current = view;
    onViewChangeRef.current = onViewChange;
  });

  // ホイールで拡大縮小する。トラックパッドのピンチも Ctrl 付きのホイールとして届く。
  // React の onWheel は passive で登録されて preventDefault できず、ページごと拡大されてしまうので、直接登録する
  useEffect(() => {
    const svg = svgRef.current!;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      // 行単位で届く環境 (Firefox など) では、おおよそのピクセル数に直す
      const delta = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 16 : e.deltaY;
      // ピンチは1回の量が小さいので、強めに効かせる
      const factor = Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0015));
      const v = viewRef.current;
      onViewChangeRef.current(zoomAt(v, toScreenLocal(svg, e), v.scale * factor));
    }
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  // Space を押している間は、ドラッグで表示を移動する
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code !== 'Space') return;
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (typing) return;
      // フォーカスしているボタンが押されたり、ページがスクロールしたりしないようにする
      e.preventDefault();
      setSpaceHeld(e.type === 'keydown');
    }
    // 押したままウィンドウを離れると keyup が来ないので、戻ったときに押していない扱いにする
    const onBlur = () => setSpaceHeld(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  /** ポインターの位置を、回路の座標にする */
  function toLocal(e: { clientX: number; clientY: number }): Point {
    return toWorld(view, toScreenLocal(svgRef.current!, e));
  }

  /** 表示している範囲の真ん中 (画面の座標) */
  function center(): Point {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: rect.width / 2, y: rect.height / 2 };
  }

  function fit() {
    const rect = svgRef.current!.getBoundingClientRect();
    onViewChange(overview(circuit, project, rect.width, rect.height));
  }

  /** 部品のドラッグや範囲選択を、途中で打ち切る (2本目の指が触れたときなど) */
  function cancelGesture() {
    dragRef.current = null;
    wireDragRef.current = null;
    placeDownRef.current = null;
    setBand(null);
    onDragModeChange('none');
  }

  /**
   * 子要素 (部品やピン) より先に受け取り、表示の移動と拡大縮小を始める。
   * 始めた場合は子要素に届けず、部品のドラッグや配線が始まらないようにする
   */
  /**
   * 貼り付ける部品を、回路の点 at を中心に置くときの、コピー元からのずれ。
   * グリッドに合わせ、シートからはみ出さないように縮める
   */
  function placeDelta(part: Circuit, at: Point): Point {
    const items = part.components.map((c) => ({ c, ports: portsOf(c, project) }));
    const rects = items.map(({ c, ports }) => componentBounds(c, ports));
    const cx = (Math.min(...rects.map((r) => r.left)) + Math.max(...rects.map((r) => r.right))) / 2;
    const cy = (Math.min(...rects.map((r) => r.top)) + Math.max(...rects.map((r) => r.bottom))) / 2;
    return clampMove(items, { x: snap(at.x - cx), y: snap(at.y - cy) });
  }

  function onPointerDownCapture(e: React.PointerEvent) {
    const svg = svgRef.current!;
    if (e.pointerType === 'touch') {
      const touches = touchesRef.current;
      touches.set(e.pointerId, toScreenLocal(svg, e));
      if (touches.size >= 2) {
        e.stopPropagation();
        if (touches.size === 2) {
          // 1本目の指で始めた操作はやめて、2本指の操作にする
          cancelGesture();
          const [a, b] = [...touches.values()];
          pinchRef.current = { mid: midpoint(a, b), distance: Math.hypot(a.x - b.x, a.y - b.y), view };
        }
        return;
      }
    }
    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      e.stopPropagation();
      // 中ボタンを押したときの自動スクロールを出さない
      e.preventDefault();
      svg.setPointerCapture(e.pointerId);
      panRef.current = { pointerId: e.pointerId, start: toScreenLocal(svg, e), view };
      setPanning(true);
      return;
    }
    if (placing && e.button === 0) {
      // 貼り付けの位置を選んでいる間は、部品の選択やドラッグを始めない
      e.stopPropagation();
      placeDownRef.current = { pointerId: e.pointerId, start: { x: e.clientX, y: e.clientY } };
    }
  }

  /** 表示の移動・拡大縮小の途中なら進めて true を返す */
  function moveView(e: React.PointerEvent): boolean {
    const svg = svgRef.current!;
    const touches = touchesRef.current;
    if (touches.has(e.pointerId)) touches.set(e.pointerId, toScreenLocal(svg, e));
    const pinch = pinchRef.current;
    if (pinch) {
      if (touches.size < 2) return true;
      const [a, b] = [...touches.values()];
      const mid = midpoint(a, b);
      const scale = (pinch.view.scale * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.distance;
      // 押した時点で指の間にあった回路の点を、今の指の間に持ってくる
      const zoomed = zoomAt(pinch.view, pinch.mid, scale);
      onViewChange({ ...zoomed, x: zoomed.x + mid.x - pinch.mid.x, y: zoomed.y + mid.y - pinch.mid.y });
      return true;
    }
    const pan = panRef.current;
    if (pan && pan.pointerId === e.pointerId) {
      const p = toScreenLocal(svg, e);
      onViewChange({ ...pan.view, x: pan.view.x + p.x - pan.start.x, y: pan.view.y + p.y - pan.start.y });
      return true;
    }
    return false;
  }

  /** 指やボタンを離した。表示の移動・拡大縮小を終えたら true を返す */
  function endView(e: React.PointerEvent): boolean {
    const touches = touchesRef.current;
    touches.delete(e.pointerId);
    if (pinchRef.current) {
      // 残った指は、すべて離れるまで何もしない (1本目の操作を続きから始めない)
      if (touches.size === 0) pinchRef.current = null;
      return true;
    }
    if (panRef.current?.pointerId === e.pointerId) {
      panRef.current = null;
      setPanning(false);
      return true;
    }
    return false;
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
    if (pending) {
      // 配線の途中なら、何もないところのクリックで折れる点を置く
      const p = toLocal(e);
      setPendingPoints([...pendingPoints, { x: snap(p.x), y: snap(p.y) }]);
      return;
    }
    const base = e.shiftKey && selection?.type === 'comp' ? selection.ids : [];
    onSelect(base.length > 0 ? { type: 'comp', ids: base } : null);
    const p = toLocal(e);
    svgRef.current!.setPointerCapture(e.pointerId);
    setBand({ start: p, end: p, base });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (moveView(e)) return;
    const p = toLocal(e);
    setMouse(p);
    const wireDrag = wireDragRef.current;
    if (wireDrag && wireDrag.pointerId === e.pointerId) {
      if (!wireDrag.started) {
        if (Math.hypot(e.clientX - wireDrag.start.x, e.clientY - wireDrag.start.y) < DRAG_THRESHOLD) return;
        svgRef.current!.setPointerCapture(e.pointerId);
        // ドラッグ全体を1回の操作として元に戻せるようにする
        onMoveStart();
        wireDrag.started = true;
      }
      onWirePointsChange(wireDrag.id, [{ x: snap(p.x), y: wireDrag.from.y }]);
      return;
    }
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
    const d = clampMove(items, {
      x: snap(p.x - drag.offset.x) - anchor.x,
      y: snap(p.y - drag.offset.y) - anchor.y,
    });
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

  function onPointerUp(e: React.PointerEvent) {
    if (endView(e)) return;
    if (wireDragRef.current?.pointerId === e.pointerId) {
      wireDragRef.current = null;
      return;
    }
    const placeDown = placeDownRef.current;
    if (placeDown && placeDown.pointerId === e.pointerId) {
      placeDownRef.current = null;
      // 押したまま大きく動かしたら、貼り付けない (指で画面をなぞっただけのときなど)
      const moved = Math.hypot(e.clientX - placeDown.start.x, e.clientY - placeDown.start.y) >= DRAG_THRESHOLD * 2;
      if (placing && !moved) onPlace(placeDelta(placing, toLocal(e)));
      return;
    }
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
      onConnect(pending, to, pendingPoints);
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

  /**
   * 配線中の仮の線。クリックで確定したときと同じ形に描く。
   * 入力ピンの上にマウスがあれば、そのピンへ入る最後の区間の形 (縦→横)。
   * 何もないところなら、そこに折れる点を置いたときの区間の形 (横→縦)
   */
  function pendingPath(from: Point, at: Point): string {
    for (const c of circuit.components) {
      const ports = portsOf(c, project);
      for (let i = 0; i < ports.inputs.length; i++) {
        const tip = inputPinPos(c, ports, i);
        // ピンの丸 (半径 6) の上にあるとき
        if (Math.hypot(tip.x - at.x, tip.y - at.y) <= 8) return wirePath(from, pendingPoints, tip);
      }
    }
    // 折れる点はグリッドに合わせて置くので、仮の線もグリッドに合わせた位置へ引く
    const p = { x: snap(at.x), y: snap(at.y) };
    return wirePath(from, [...pendingPoints, p], p);
  }

  const transform = `translate(${view.x} ${view.y}) scale(${view.scale})`;
  /** シートの画面上の範囲。この外には部品を置けない */
  const sheetStart = toScreen(view, { x: 0, y: 0 });
  const sheetEnd = toScreen(view, { x: SHEET_WIDTH, y: SHEET_HEIGHT });

  const pendingFrom = pending && compMap.get(pending.comp);

  return (
    <div className={styles.sheetWrap}>
      <svg
        ref={svgRef}
        className={classNames(styles.sheet, (spaceHeld || panning) && styles.panning)}
        onPointerDownCapture={onPointerDownCapture}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={(e) => {
          if (endView(e)) return;
          cancelGesture();
        }}
        onPointerDown={onBackgroundPointerDown}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DRAG_MIME)) e.preventDefault();
        }}
        onDrop={onDrop}
      >
        <defs>
          {/* 方眼は表示と一緒に動かす。線の太さは倍率によらず 1px のままにする */}
          <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse" patternTransform={transform}>
            <path d={`M${GRID},0 V${GRID} H0`} fill="none" stroke="var(--grid)" strokeWidth={1 / view.scale} />
          </pattern>
        </defs>
        {showGrid && <rect width="100%" height="100%" fill="url(#grid)" />}
        {/* シートの外 (部品を置けない範囲)。画面全体から、シートの範囲をくり抜いて塗る */}
        <path
          className={styles.outside}
          fillRule="evenodd"
          d={`M0,0 H${width} V${height} H0 Z M${sheetStart.x},${sheetStart.y} V${sheetEnd.y} H${sheetEnd.x} V${sheetStart.y} Z`}
        />
        <rect
          className={styles.edge}
          x={sheetStart.x}
          y={sheetStart.y}
          width={sheetEnd.x - sheetStart.x}
          height={sheetEnd.y - sheetStart.y}
        />

        {/* ここから下は回路の座標で描く */}
        <g transform={transform}>
          {circuit.wires.map((w) => {
            const from = compMap.get(w.from.comp);
            const to = compMap.get(w.to.comp);
            if (!from || !to) return null;
            const fromPorts = portsOf(from, project);
            const toPorts = portsOf(to, project);
            // モジュールのピンが減った場合など、存在しないピンへの配線は描かない
            if (w.from.pin >= fromPorts.outputs.length || w.to.pin >= toPorts.inputs.length) return null;
            const a = outputPinPos(from, fromPorts, w.from.pin);
            const b = inputPinPos(to, toPorts, w.to.pin);
            const d = wirePath(a, w.points ?? [], b);
            const midX = middleX(a, w.points ?? [], b);
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
                {/* 中央の縦線は、左右にドラッグして動かせる */}
                {midX !== undefined && (
                  <path
                    className={styles.wireMiddle}
                    d={`M${midX},${a.y} V${b.y}`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelect({ type: 'wire', id: w.id });
                      wireDragRef.current = {
                        id: w.id,
                        pointerId: e.pointerId,
                        start: { x: e.clientX, y: e.clientY },
                        from: a,
                        started: false,
                      };
                    }}
                  />
                )}
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
                pinNumber={pinNumbers.get(c.id)}
                onBodyDown={(e) => onCompPointerDown(e, c)}
                onBodyDoubleClick={() => onComponentDoubleClick(c)}
                onInputPinDown={(e, pin) => onInputPinDown(e, c, pin)}
                onOutputPinDown={(e, pin) => {
                  e.stopPropagation();
                  onPendingChange({ comp: c.id, pin });
                  setPendingPoints([]);
                }}
              />
            );
          })}

          {band && (
            <rect
              className={styles.band}
              vectorEffect="non-scaling-stroke"
              x={Math.min(band.start.x, band.end.x)}
              y={Math.min(band.start.y, band.end.y)}
              width={Math.abs(band.end.x - band.start.x)}
              height={Math.abs(band.end.y - band.start.y)}
            />
          )}

          {placing &&
            (() => {
              // まだポインターがシートに来ていなければ (スマホなど)、表示している範囲の真ん中に置く
              const d = placeDelta(placing, mouse ?? toWorld(view, center()));
              const parts = new Map(placing.components.map((c) => [c.id, c]));
              return (
                <g className={styles.ghost} transform={`translate(${d.x} ${d.y})`}>
                  {placing.wires.map((w) => {
                    const from = parts.get(w.from.comp)!;
                    const to = parts.get(w.to.comp)!;
                    const d = wirePath(
                      outputPinPos(from, portsOf(from, project), w.from.pin),
                      w.points ?? [],
                      inputPinPos(to, portsOf(to, project), w.to.pin),
                    );
                    return <path key={w.id} className={styles.wire} d={d} />;
                  })}
                  {placing.components.map((c) => {
                    const ports = portsOf(c, project);
                    return (
                      <ComponentView
                        key={c.id}
                        comp={c}
                        ports={ports}
                        name={c.kind === 'CUSTOM' ? findDef(project, c.custom)?.name : undefined}
                        outputValues={Array.from({ length: Math.max(ports.outputs.length, 1) }, () => false)}
                        inputValues={ports.inputs.map(() => false)}
                        selected
                        onBodyDown={() => {}}
                        onBodyDoubleClick={() => {}}
                        onInputPinDown={() => {}}
                        onOutputPinDown={() => {}}
                      />
                    );
                  })}
                </g>
              );
            })()}

          {pending && pendingFrom && mouse && (
            <path
              className={styles.pending}
              d={pendingPath(outputPinPos(pendingFrom, portsOf(pendingFrom, project), pending.pin), mouse)}
            />
          )}
        </g>
      </svg>
      <ZoomControls
        scale={view.scale}
        onZoomIn={() => onViewChange(zoomAt(view, center(), view.scale * ZOOM_STEP))}
        onZoomOut={() => onViewChange(zoomAt(view, center(), view.scale / ZOOM_STEP))}
        onReset={() => onViewChange(zoomAt(view, center(), 1))}
        onFit={fit}
      />
    </div>
  );
}
