import { Stack } from '@chakra-ui/react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  clampMove,
  clampToSheet,
  dragWireEnd,
  getSheetEnd,
  partsInRect,
  GRID,
  calcSheetPins,
  placeOffset,
  type Point,
  simplifyWire,
  snap,
  type WireEnd,
  wiresInRect,
  wireStepTo,
} from '../geometry/layout';
import {
  findSplitTarget,
  findWireJoints,
  isConflict,
  isOnWire,
  type Net,
  netLinks,
  type Nets,
  onSegment,
} from '../geometry/net';
import type { Part, PartKind } from '../circuit/part';
import type { Circuit, Wire } from '../circuit/circuit';
import {
  findDef,
  getCircuitSheet,
  type CircuitDef,
  type CircuitSheet,
  type Project,
} from '../circuit/project';
import { findUnexposedPorts, getPinout } from '../circuit/module';
import { pinKey, type SimResult } from '../simulation/sim';
import type { SimStore } from '../simulation/useSimulation';
import type { Tool } from '../simulation/SheetToolbar';
import { SheetPart } from './SheetPart';
import { classNames } from '../ui/classNames';
import { selectionOf, type Selection } from '../editing/edit';
import { DRAG_MIME, type PaletteDrag } from '../palette/drag';
import styles from './Sheet.module.css';
import { toScreenLocal, useViewGestures } from './useViewGestures';
import { overview, toScreen, toWorld, zoomAt, type View } from '../geometry/view';
import { wirePath } from './wirePath';
import { TrashZone } from './TrashZone';
import { ZoomControls } from './ZoomControls';

/** 部品をドラッグ中か。'trash' は削除エリアの上 (離すと削除)。'wireEnd' は配線の端のドラッグ中 */
export type DragMode = 'none' | 'moving' | 'trash' | 'wireEnd';

export interface SheetSize {
  width: number;
  height: number;
}

/** 押した部品か配線 */
interface DragTarget {
  type: 'comp' | 'wire';
  id: string;
}

interface Drag {
  target: DragTarget;
  /** 押した位置 (回路の座標) */
  origin: Point;
  /** 一緒に動かす部品 (押したものを含む) と、ドラッグ開始時の位置 */
  comps: Map<string, Point>;
  /** 一緒に動かす配線と、ドラッグ開始時の点の並び */
  wires: Map<string, Point[]>;
  /** 最後に動かした量 (ドラッグ開始時から)。同じ量なら動かし直さない */
  delta: Point;
  moved: boolean;
  /** このドラッグで onMoveStart を呼んだか */
  started: boolean;
  pointerId: number;
  /** 押した位置 (クライアント座標) */
  start: Point;
}

/** 配線の端のドラッグ (長さを変える) */
interface EndDrag {
  wire: string;
  end: WireEnd;
  /** ドラッグを始めたときの点の並び。端の位置は、毎回これから求める (dragWireEnd) */
  origin: Point[];
  /** 今の点の並び (仮の形)。同じなら描き直さない */
  points: Point[];
  /** 動かし始めたか (押しただけ・わずかに動いただけなら false) */
  started: boolean;
  pointerId: number;
  /** 押した位置 (クライアント座標) */
  start: Point;
}

/** 範囲選択 */
interface Band {
  start: Point;
  end: Point;
  /** Shift を押して始めたときの、元の選択 (範囲内の部品と配線を追加する) */
  base: Selection;
}

/** 貼り付ける部品と配線のうち、配線の点をすべて並べたもの (貼り付ける位置の計算に使う) */
function wirePointsOf(fragment: Circuit): Point[] {
  return fragment.wires.flatMap((w) => w.points);
}

/** ネットの値。出力ピンがちょうど 1 つならその値。ないか、2 つ以上 (ぶつかっている) なら OFF */
function netValue(net: Net | undefined, sim: SimResult): boolean {
  const driver = net?.outputs.length === 1 ? net.outputs[0] : undefined;
  return !!driver && !!sim.values.get(pinKey(driver.comp, driver.pin));
}

/**
 * 配線の点を置く位置。グリッドに合わせ、シートの範囲 (端を含む) に収める。
 * 範囲の外に点があると、まとめて動かすときのはみ出しの判定 (clampMove) の前提が崩れるため
 */
function wireGridPoint(at: Point, sheet: CircuitSheet): Point {
  return clampToSheet({ x: snap(at.x), y: snap(at.y) }, sheet);
}

/** 押した位置からこれ以上動いたらドラッグとみなす (px) */
const DRAG_THRESHOLD = 4;

/** 配線の端の印 (つまみ) の一辺と、押せる範囲の一辺 (画面上の px。拡大縮小しても変えない) */
const HANDLE_SIZE = 6;
const HANDLE_HIT = 20;

/**
 * 配線の端の区間が横向きか。端の区間が長さ 0 (端のドラッグで折れる点まで縮めた途中) なら、
 * その先の区間と直角の向きにする (縮める前の端の区間の向き)
 */
function isHorizontalEnd(points: readonly Point[], end: WireEnd): boolean {
  const n = points.length;
  const [tip, anchor, next] =
    end === 'start'
      ? [points[0], points[1], points[2]]
      : [points[n - 1], points[n - 2], points[n - 3]];
  if (tip.x !== anchor.x || tip.y !== anchor.y || !next) {
    return tip.y === anchor.y;
  }
  return anchor.x === next.x;
}

/** 分割モードの印 (線に直角の短い線) の長さ。分かれ目と、分ける点 (画面上の px。拡大縮小しても変えない) */
const JOINT_MARK = 10;
const SPLIT_MARK = 12;

/** 点 at を通る、長さ len の短い線のパス。区間が横向きなら縦に、縦向きなら横に引く (区間と直角) */
function tickPath(at: Point, horizontal: boolean, len: number): string {
  return horizontal
    ? `M${at.x},${at.y - len / 2} V${at.y + len / 2}`
    : `M${at.x - len / 2},${at.y} H${at.x + len / 2}`;
}

/** 配線の、点 at を含む最初の区間が横向きか */
function isHorizontalAt(points: readonly Point[], at: Point): boolean {
  const i = points.findIndex((b, j) => j > 0 && onSegment(at, points[j - 1], b));
  return i > 0 && points[i - 1].y === points[i].y;
}

/** 拡大・縮小ボタン1回で変える倍率 */
const ZOOM_STEP = 1.25;

interface SheetProps {
  project: Project;
  circuit: CircuitDef;
  /** circuit の配線のつながり (geometry/net.ts) */
  nets: Nets;
  /** 選択モードか配線モードか */
  tool: Tool;
  /** シミュレーションの結果。tick ごとに変わるので、props ではなく購読して受け取る (App を描き直さないため) */
  simStore: SimStore;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  /** 配線中に置いた点 (始点から順に)。配線中でなければ null */
  pending: Point[] | null;
  onPendingChange: (pending: Point[] | null) => void;
  dragMode: DragMode;
  onDragModeChange: (mode: DragMode) => void;
  onResize: (size: SheetSize) => void;
  /** 表示位置と倍率 (スクロールと拡大縮小) */
  view: View;
  onViewChange: (view: View) => void;
  /** 方眼を表示するか (環境設定) */
  showGrid: boolean;
  /** 配線の角を丸めるか (環境設定) */
  roundWires: boolean;
  /** パレットから部品がドロップされた */
  onAdd: (kind: PartKind, module: string | undefined, at: Point) => void;
  /** 部品のドラッグで最初に位置が変わる直前。ドラッグ全体を1回の操作にするために使う */
  onMoveStart: () => void;
  /** 選んでいる部品と配線を動かした。comps は部品の新しい位置、wires は配線の新しい点の並び */
  onMove: (comps: Map<string, Point>, wires: Map<string, Point[]>) => void;
  /**
   * 配線の端のドラッグを終えた。points は最後の点の並び (長さ 0 の区間が残ることがある)。
   * ドラッグの途中は回路を変えず (つながりとシミュレーションを変えないため)、ここで初めて知らせる
   */
  onWireReshapeEnd: (id: string, end: WireEnd, points: Point[]) => void;
  /** 分割モードで、配線を点 at で 2 本に分ける (at は分けてよい点) */
  onSplitWire: (id: string, at: Point) => void;
  /** 選んでいるものを削除エリアで離した。moved はそれまでに位置を動かしたか */
  onDropOnTrash: (moved: boolean) => void;
  /** INPUT が (ドラッグせずに) クリックされた */
  onToggle: (id: string) => void;
  /** 配線を描き終えた。points は始点から終点までの点の並び (どの区間も縦か横) */
  onAddWire: (points: Point[]) => void;
  onPartDoubleClick: (c: Part) => void;
  /** 貼り付ける位置を選んでいる部品と配線 (コピー元の位置のまま)。ポインターについて動き、クリックで確定する */
  placing: Circuit | null;
  /** 貼り付ける位置が決まった。delta はコピー元の位置からのずれ */
  onPlace: (delta: Point) => void;
}

/** 回路を描き、部品のドラッグ・配線・パレットからのドロップを受け付けるシート */
export function Sheet({
  project,
  circuit,
  nets,
  tool,
  simStore,
  selection,
  onSelect,
  pending,
  onPendingChange,
  dragMode,
  onDragModeChange,
  onResize,
  view,
  onViewChange,
  showGrid,
  roundWires,
  onAdd,
  onMoveStart,
  onMove,
  onWireReshapeEnd,
  onSplitWire,
  onDropOnTrash,
  onToggle,
  onAddWire,
  onPartDoubleClick,
  placing,
  onPlace,
}: SheetProps) {
  const sim = useSyncExternalStore(simStore.subscribe, simStore.get);
  /** 部品を落とすと削除するエリア。落としたかは、画面上の位置で判定する */
  const trashRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  /** シートの svg。イベントはシートが表示されてからしか起きないので、ハンドラーの中では必ずある */
  function sheetSvg(): SVGSVGElement {
    const svg = svgRef.current;
    if (!svg) {
      throw new Error('シートの svg がまだありません');
    }
    return svg;
  }
  const dragRef = useRef<Drag | null>(null);
  const endDragRef = useRef<EndDrag | null>(null);
  /** ドラッグしている配線の端と、その向き。印を強調し、ポインターの形を保つのに使う */
  const [activeEnd, setActiveEnd] = useState<{ end: WireEnd; horizontal: boolean } | null>(null);
  /**
   * 端のドラッグ中の配線の仮の形。回路はまだ変えず、この形で描くだけにする
   * (ドラッグの途中でつながりとシミュレーションを変えないため。分岐の印も元の位置に残る)
   */
  const [preview, setPreview] = useState<{ wire: string; points: Point[] } | null>(null);
  const [band, setBand] = useState<Band | null>(null);
  const sheet = getCircuitSheet(circuit);
  const [{ width, height }, setSize] = useState<SheetSize>({
    width: 0,
    height: 0,
  });
  /** ポインターの位置 (回路の座標)。配線中の線の先と、貼り付ける部品の位置に使う。シートの上に来るまでは null */
  const [mouse, setMouse] = useState<Point | null>(null);
  /** 貼り付けのために押した位置 (クライアント座標)。離したときに、動かしていなければ貼り付ける */
  const placeDownRef = useRef<{ pointerId: number; start: Point } | null>(null);
  const compMap = useMemo(() => new Map(circuit.parts.map((c) => [c.id, c])), [circuit]);
  const wireMap = useMemo(() => new Map(circuit.wires.map((w) => [w.id, w])), [circuit]);
  /** 入力ピン (pinKey) → それを動かす出力ピン。表示する入力ピンの値に使う */
  const drivers = useMemo(
    () => new Map(netLinks(nets.nets).map((l) => [pinKey(l.to.comp, l.to.pin), l.from])),
    [nets],
  );
  /** ピンの先の位置 ("x,y")。配線をつないで終えるかの判定に使う */
  const pinTips = useMemo(() => {
    const tips = new Set<string>();
    for (const c of circuit.parts) {
      // 配置は部品ごとに 1 回だけ求める (ピンの多いモジュールで重くならないよう)
      const pins = calcSheetPins(c, getPinout(c, project));
      for (const p of [...pins.inputs, ...pins.outputs]) {
        tips.add(`${p.tip.x},${p.tip.y}`);
      }
    }
    return tips;
  }, [circuit, project]);
  const selectedComps = useMemo(() => new Set(selection?.comps ?? []), [selection]);
  const selectedWires = useMemo(() => new Set(selection?.wires ?? []), [selection]);
  /** 外側のピンに出せないポート (部品 ID → 理由)。印を付ける */
  const problems = useMemo(() => findUnexposedPorts(circuit), [circuit]);

  // 部品を追加するとき、表示している範囲の真ん中に置けるよう、大きさを知らせる
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }
    const observer = new ResizeObserver(() => {
      const rect = svg.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
      onResize({ width: rect.width, height: rect.height });
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, [onResize]);

  const { spaceHeld, panning, startView, moveView, endView } = useViewGestures({
    svgRef,
    view,
    onViewChange,
    onCancelGesture: cancelGesture,
  });

  /** 部品と、そのピンの並び (geometry/layout.ts の計算に渡す形) */
  function attachPinouts(parts: Part[]) {
    return parts.map((c) => ({ c, pinout: getPinout(c, project) }));
  }

  /** ポインターの位置を、回路の座標にする */
  function toLocal(e: { clientX: number; clientY: number }): Point {
    return toWorld(view, toScreenLocal(sheetSvg(), e));
  }

  /** 表示している範囲の真ん中 (画面の座標) */
  function center(): Point {
    const rect = sheetSvg().getBoundingClientRect();
    return { x: rect.width / 2, y: rect.height / 2 };
  }

  function fit() {
    const rect = sheetSvg().getBoundingClientRect();
    onViewChange(overview(circuit, project, rect.width, rect.height));
  }

  // ズームのボタンに渡す関数。ZoomControls は React.memo なので、部品のドラッグで描き直さないよう同じ関数を渡し続け、
  // 中身は最新の描画の表示を見る
  const zoomLatest = useRef({ view, center, fit, onViewChange });
  zoomLatest.current = { view, center, fit, onViewChange };
  const zoom = useMemo(() => {
    const zoomTo = (scale: (s: number) => number) => {
      const { view: v, center: c, onViewChange: change } = zoomLatest.current;
      change(zoomAt(v, c(), scale(v.scale)));
    };
    return {
      in: () => zoomTo((s) => s * ZOOM_STEP),
      out: () => zoomTo((s) => s / ZOOM_STEP),
      reset: () => zoomTo(() => 1),
      fit: () => zoomLatest.current.fit(),
    };
  }, []);

  /** 部品のドラッグや範囲選択を、途中で打ち切る (2本目の指が触れたときなど) */
  function cancelGesture() {
    // 配線の端のドラッグは、途中までの長さで終える (長さ 0 の区間を残したままにしないため)
    const endDrag = endDragRef.current;
    if (endDrag) {
      finishWireEnd(endDrag);
    }
    dragRef.current = null;
    placeDownRef.current = null;
    setBand(null);
    onDragModeChange('none');
  }

  function onPointerDownCapture(e: React.PointerEvent) {
    if (startView(e)) {
      return;
    }
    if (placing && e.button === 0) {
      // 貼り付けの位置を選んでいる間は、部品の選択やドラッグを始めない
      e.stopPropagation();
      placeDownRef.current = {
        pointerId: e.pointerId,
        start: { x: e.clientX, y: e.clientY },
      };
      return;
    }
    if (tool === 'wire' && e.button === 0) {
      // 配線モードでは、部品・ピン・配線の上も含めて、どこを押しても配線の点を置く
      e.stopPropagation();
      onWireClick(toLocal(e));
    }
    if (tool === 'split' && e.button === 0) {
      // 分割モードでは、部品や配線の上を押しても選択やドラッグを始めない。分けられる点なら分ける
      e.stopPropagation();
      const p = wireGridPoint(toLocal(e), sheet);
      const target = findSplitTarget(circuit.wires, pinTips, p);
      if (target && !target.blocked) {
        onSplitWire(target.wire.id, p);
      }
    }
  }

  /**
   * 配線モードでのクリック。at はポインターの位置 (回路の座標)。
   * 配線中でなければ、そこから始める。配線中なら、最後の点から縦か横に伸ばした先に点を置き、
   * その点がピンの先か配線の上ならつないで終える。最後の点と同じ点なら、そこで終える
   */
  function onWireClick(at: Point) {
    const p = wireGridPoint(at, sheet);
    if (!pending) {
      onPendingChange([p]);
      return;
    }
    const last = pending[pending.length - 1];
    const next = wireStepTo(last, p);
    if (next.x === last.x && next.y === last.y) {
      // 点が 1 つだけ (始点をもう一度押した) なら、配線にならないので取り消す
      if (pending.length >= 2) {
        onAddWire(simplifyWire(pending));
      }
      onPendingChange(null);
      return;
    }
    const points = [...pending, next];
    const connects =
      pinTips.has(`${next.x},${next.y}`) || circuit.wires.some((w) => isOnWire(next, w));
    if (connects) {
      onAddWire(simplifyWire(points));
      onPendingChange(null);
      return;
    }
    onPendingChange(points);
  }

  /** 押したものからドラッグを始める。選択中のものを押したら、選択中のものをまとめて動かす */
  function startDrag(e: React.PointerEvent, target: DragTarget) {
    const inSelection =
      target.type === 'comp' ? selectedComps.has(target.id) : selectedWires.has(target.id);
    const moving =
      inSelection && selection
        ? selection
        : target.type === 'comp'
          ? { comps: [target.id], wires: [] }
          : { comps: [], wires: [target.id] };
    dragRef.current = {
      target,
      origin: toLocal(e),
      comps: new Map(
        moving.comps.flatMap((id) => {
          const c = compMap.get(id);
          return c ? [[id, { x: c.x, y: c.y }] as const] : [];
        }),
      ),
      wires: new Map(
        moving.wires.flatMap((id) => {
          const w = wireMap.get(id);
          return w ? [[id, w.points] as const] : [];
        }),
      ),
      delta: { x: 0, y: 0 },
      moved: false,
      started: false,
      pointerId: e.pointerId,
      start: { x: e.clientX, y: e.clientY },
    };
    if (!inSelection) {
      onSelect(moving);
    }
  }

  /** Shift+クリックで、部品か配線を選択に追加・解除する。ドラッグは始めない */
  function toggleSelected(target: DragTarget) {
    const toggle = (ids: string[]) =>
      ids.includes(target.id) ? ids.filter((x) => x !== target.id) : [...ids, target.id];
    const comps = selection?.comps ?? [];
    const wires = selection?.wires ?? [];
    onSelect(
      target.type === 'comp'
        ? selectionOf(toggle(comps), wires)
        : selectionOf(comps, toggle(wires)),
    );
  }

  function onCompPointerDown(e: React.PointerEvent, c: Part) {
    e.stopPropagation();
    if (e.shiftKey) {
      toggleSelected({ type: 'comp', id: c.id });
      return;
    }
    startDrag(e, { type: 'comp', id: c.id });
  }

  function onWirePointerDown(e: React.PointerEvent, w: Wire) {
    e.stopPropagation();
    if (e.shiftKey) {
      toggleSelected({ type: 'wire', id: w.id });
      return;
    }
    startDrag(e, { type: 'wire', id: w.id });
  }

  /** 配線の端の印を押したら、端のドラッグを始める (動かし始めるまでは何もしない) */
  function onWireEndPointerDown(e: React.PointerEvent, w: Wire, end: WireEnd) {
    e.stopPropagation();
    endDragRef.current = {
      wire: w.id,
      end,
      origin: w.points,
      points: w.points,
      started: false,
      pointerId: e.pointerId,
      start: { x: e.clientX, y: e.clientY },
    };
  }

  function moveWireEnd(e: React.PointerEvent, endDrag: EndDrag) {
    const svg = sheetSvg();
    if (!svg.hasPointerCapture(endDrag.pointerId)) {
      // 押しただけ・わずかに動いただけなら、何もしない (選択はそのまま)
      if (Math.hypot(e.clientX - endDrag.start.x, e.clientY - endDrag.start.y) < DRAG_THRESHOLD) {
        return;
      }
      svg.setPointerCapture(endDrag.pointerId);
    }
    const next = dragWireEnd(endDrag.origin, endDrag.end, toLocal(e), sheet);
    if (next.every((p, i) => p.x === endDrag.points[i].x && p.y === endDrag.points[i].y)) {
      return;
    }
    if (!endDrag.started) {
      endDrag.started = true;
      onDragModeChange('wireEnd');
      setActiveEnd({ end: endDrag.end, horizontal: isHorizontalEnd(endDrag.origin, endDrag.end) });
    }
    endDrag.points = next;
    setPreview({ wire: endDrag.wire, points: next });
  }

  function finishWireEnd(endDrag: EndDrag) {
    endDragRef.current = null;
    setActiveEnd(null);
    setPreview(null);
    if (!endDrag.started) {
      return;
    }
    onDragModeChange('none');
    // 動かしてから元の位置に戻して離したときは、何も変わっていないので履歴に積まない
    const same = endDrag.points.every(
      (p, i) => p.x === endDrag.origin[i].x && p.y === endDrag.origin[i].y,
    );
    if (!same) {
      onWireReshapeEnd(endDrag.wire, endDrag.end, endDrag.points);
    }
  }

  /** 何もないところを押したら、範囲選択を始める */
  function onBackgroundPointerDown(e: React.PointerEvent) {
    const base = e.shiftKey ? selection : null;
    onSelect(base);
    const p = toLocal(e);
    sheetSvg().setPointerCapture(e.pointerId);
    setBand({ start: p, end: p, base });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (moveView(e)) {
      return;
    }
    const p = toLocal(e);
    setMouse(p);
    if (band) {
      setBand({ ...band, end: p });
      const comps = new Set([
        ...(band.base?.comps ?? []),
        ...partsInRect(attachPinouts(circuit.parts), band.start, p),
      ]);
      const wires = new Set([
        ...(band.base?.wires ?? []),
        ...wiresInRect(circuit.wires, band.start, p),
      ]);
      onSelect(selectionOf([...comps], [...wires]));
      return;
    }
    const endDrag = endDragRef.current;
    if (endDrag) {
      moveWireEnd(e, endDrag);
      return;
    }
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    const svg = sheetSvg();
    if (!svg.hasPointerCapture(drag.pointerId)) {
      // 押しただけ・わずかに動いただけならクリック (ダブルクリック) として扱う
      if (Math.hypot(e.clientX - drag.start.x, e.clientY - drag.start.y) < DRAG_THRESHOLD) {
        return;
      }
      // シートの外 (削除エリアの上など) に出ても移動イベントを受け取り続ける。
      // 押した時点でキャプチャすると、クリックやダブルクリックが部品に届かなくなるため、ドラッグが始まってから行う
      svg.setPointerCapture(drag.pointerId);
    }
    const rect = trashRef.current?.getBoundingClientRect();
    const overTrash =
      !!rect &&
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    if (overTrash) {
      // 削除エリアの上では部品は動かさない
      drag.moved = true;
      onDragModeChange('trash');
      return;
    }
    // 削除エリアから外れたら、ふつうのドラッグの表示に戻す
    if (drag.moved) {
      onDragModeChange('moving');
    }
    // ドラッグ開始時の位置からの移動量。押した位置からポインターまでの差をグリッドに合わせ、
    // どの部品も配線の点もはみ出さないように縮める。部品と配線の点はグリッドに乗っているので、動かしても乗ったまま
    const items = [...drag.comps].flatMap(([id, o]) => {
      const c = compMap.get(id);
      return c ? [{ c: { ...c, ...o }, pinout: getPinout(c, project) }] : [];
    });
    const d = clampMove(
      items,
      { x: snap(p.x - drag.origin.x), y: snap(p.y - drag.origin.y) },
      sheet,
      [...drag.wires.values()].flat(),
    );
    if (d.x === drag.delta.x && d.y === drag.delta.y) {
      return;
    }
    drag.delta = d;
    drag.moved = true;
    onDragModeChange('moving');
    if (!drag.started) {
      onMoveStart();
      drag.started = true;
    }
    const shift = (q: Point) => ({ x: q.x + d.x, y: q.y + d.y });
    onMove(
      new Map(items.map(({ c }) => [c.id, shift(c)])),
      new Map([...drag.wires].map(([id, points]) => [id, points.map(shift)])),
    );
  }

  function onPointerUp(e: React.PointerEvent) {
    if (endView(e)) {
      return;
    }
    const placeDown = placeDownRef.current;
    if (placeDown && placeDown.pointerId === e.pointerId) {
      placeDownRef.current = null;
      // 押したまま大きく動かしたら、貼り付けない (指で画面をなぞっただけのときなど)
      const moved =
        Math.hypot(e.clientX - placeDown.start.x, e.clientY - placeDown.start.y) >=
        DRAG_THRESHOLD * 2;
      if (placing && !moved) {
        onPlace(
          placeOffset(attachPinouts(placing.parts), wirePointsOf(placing), toLocal(e), sheet),
        );
      }
      return;
    }
    setBand(null);
    const endDrag = endDragRef.current;
    if (endDrag) {
      finishWireEnd(endDrag);
      return;
    }
    const drag = dragRef.current;
    dragRef.current = null;
    onDragModeChange('none');
    if (!drag) {
      return;
    }
    if (dragMode === 'trash') {
      // 動かしていれば onMoveStart で履歴を積んであるので、削除はその 1 回の操作に含める (App.tsx)
      onDropOnTrash(drag.started);
      return;
    }
    if (drag.moved) {
      return;
    }
    // 動かさずに離したら、押したものだけを選ぶ。スイッチはトグル
    const { type, id } = drag.target;
    onSelect(type === 'comp' ? { comps: [id], wires: [] } : { comps: [], wires: [id] });
    if (type === 'comp' && compMap.get(id)?.kind === 'input') {
      onToggle(id);
    }
  }

  function onDrop(e: React.DragEvent) {
    const data = e.dataTransfer.getData(DRAG_MIME);
    if (!data) {
      return;
    }
    e.preventDefault();
    const { kind, module } = JSON.parse(data) as PaletteDrag;
    const p = toLocal(e);
    // カーソルが部品の左上付近に来るよう少しずらす
    onAdd(kind, module, { x: p.x - GRID, y: p.y - GRID });
  }

  /**
   * 配線モードで、ポインターの位置でクリックしたときに置かれる点。
   * クリックしたときと同じ計算 (onWireClick) にしないと、クリックした後に線が違う位置へ動いて見える
   */
  function wireCursor(at: Point): Point {
    const p = wireGridPoint(at, sheet);
    return pending ? wireStepTo(pending[pending.length - 1], p) : p;
  }

  const transform = `translate(${view.x} ${view.y}) scale(${view.scale})`;
  /** シートの画面上の範囲。この外には部品を置けない */
  const sheetStart = toScreen(view, { x: 0, y: 0 });
  const sheetEnd = toScreen(view, getSheetEnd(sheet));
  const cursor = tool === 'wire' && mouse && !placing ? wireCursor(mouse) : null;
  // 分割モードで、ポインターの下の分ける点 (blocked なら分けられない点)
  const splitPoint = tool === 'split' && mouse && !placing ? wireGridPoint(mouse, sheet) : null;
  const splitTarget = splitPoint && findSplitTarget(circuit.wires, pinTips, splitPoint);
  /** 配線の描く形。端のドラッグ中の配線は仮の形 */
  function pointsOf(w: Wire): Point[] {
    return preview?.wire === w.id ? preview.points : w.points;
  }
  // 端の印を出す配線。選択モードで、配線を 1 本だけ (部品も選ばずに) 選んでいるとき
  const handleWire =
    tool === 'select' && !placing && selection?.comps.length === 0 && selection.wires.length === 1
      ? wireMap.get(selection.wires[0])
      : undefined;

  return (
    <div className={styles.sheetWrap}>
      {/* biome-ignore lint/a11y/noSvgWithoutTitle: 描画面なので題は付けない (title を付けるとシート全体にツールチップが出る) */}
      <svg
        ref={svgRef}
        className={classNames(
          styles.sheet,
          tool === 'wire' && styles.wireTool,
          tool === 'split' && (splitTarget?.blocked ? styles.splitBlocked : styles.splitTool),
          (spaceHeld || panning) && styles.panning,
          activeEnd && (activeEnd.horizontal ? styles.resizingX : styles.resizingY),
        )}
        onPointerDownCapture={onPointerDownCapture}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={(e) => {
          if (endView(e)) {
            return;
          }
          cancelGesture();
        }}
        onPointerDown={onBackgroundPointerDown}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DRAG_MIME)) {
            e.preventDefault();
          }
        }}
        onDrop={onDrop}
      >
        <defs>
          {/* 方眼は表示と一緒に動かす。線の太さは倍率によらず 1px のままにする (拡大されるので 1 / scale にする)。
              1 マスごとに、右端の縦線と下端の横線だけを描く (M20,0 V20 H0)。隣のマスと並べると格子になる */}
          <pattern
            id="grid"
            width={GRID}
            height={GRID}
            patternUnits="userSpaceOnUse"
            patternTransform={transform}
          >
            <path
              d={`M${GRID},0 V${GRID} H0`}
              fill="none"
              stroke="var(--chakra-colors-sheet-grid)"
              strokeWidth={1 / view.scale}
            />
          </pattern>
        </defs>
        {showGrid && <rect width="100%" height="100%" fill="url(#grid)" />}
        {/* シートの外 (部品を置けない範囲)。画面全体の長方形と、シートの範囲の長方形を 1 つのパスにし、
            evenodd で 2 つの間だけを塗る (内側はくり抜かれる) */}
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
            const net = nets.wireNet.get(w.id);
            const d = wirePath(pointsOf(w), roundWires);
            return (
              <g key={w.id}>
                <path
                  className={classNames(
                    styles.wire,
                    netValue(net, sim) && styles.on,
                    net && isConflict(net) && styles.conflict,
                    selectedWires.has(w.id) && styles.selected,
                  )}
                  d={d}
                />
                <path
                  className={styles.wireHit}
                  d={d}
                  onPointerDown={(e) => onWirePointerDown(e, w)}
                />
              </g>
            );
          })}

          {/* 分岐の印。配線の途中から分かれている点など、3 本以上の線が集まる点に描き、交差しているだけの点と見分ける */}
          {nets.junctions.map(({ at, wire }) => {
            const net = nets.wireNet.get(wire);
            return (
              <circle
                key={`${at.x},${at.y}`}
                className={classNames(
                  styles.junction,
                  netValue(net, sim) && styles.on,
                  net && isConflict(net) && styles.conflict,
                )}
                cx={at.x}
                cy={at.y}
                r={4}
              />
            );
          })}

          {circuit.parts.map((c) => {
            const pinout = getPinout(c, project);
            return (
              <SheetPart
                key={c.id}
                comp={c}
                pinout={pinout}
                name={c.kind === 'module' ? findDef(project, c.module)?.name : undefined}
                outputValues={Array.from(
                  { length: Math.max(pinout.outputs.length, 1) },
                  (_, i) => !!sim.values.get(pinKey(c.id, i)),
                )}
                inputValues={pinout.inputs.map((_, i) => {
                  const from = drivers.get(pinKey(c.id, i));
                  return from ? !!sim.values.get(pinKey(from.comp, from.pin)) : false;
                })}
                selected={selectedComps.has(c.id)}
                portProblem={problems.get(c.id)}
                onBodyDown={(e) => onCompPointerDown(e, c)}
                onBodyDoubleClick={() => onPartDoubleClick(c)}
              />
            );
          })}

          {/* 選んだ配線の端の印。押せる範囲は見た目より広くする。どちらも拡大縮小しても画面上の大きさを変えない */}
          {handleWire &&
            (['start', 'end'] as const).map((end) => {
              const pts = pointsOf(handleWire);
              const p = end === 'start' ? pts[0] : pts[pts.length - 1];
              const size = HANDLE_SIZE / view.scale;
              const hit = HANDLE_HIT / view.scale;
              return (
                <g
                  key={end}
                  className={classNames(
                    styles.wireHandle,
                    isHorizontalEnd(pts, end) ? styles.resizeX : styles.resizeY,
                    activeEnd?.end === end && styles.active,
                  )}
                  onPointerDown={(e) => onWireEndPointerDown(e, handleWire, end)}
                >
                  <rect
                    className={styles.wireHandleHit}
                    x={p.x - hit / 2}
                    y={p.y - hit / 2}
                    width={hit}
                    height={hit}
                  />
                  <rect
                    className={styles.wireHandleMark}
                    vectorEffect="non-scaling-stroke"
                    x={p.x - size / 2}
                    y={p.y - size / 2}
                    width={size}
                    height={size}
                  />
                </g>
              );
            })}

          {/* 分割モードの印。分かれ目 (分けた所など) と、ポインターの下の分ける点 */}
          {tool === 'split' && !placing && (
            <SplitMarks
              wires={circuit.wires}
              pinTips={pinTips}
              scale={view.scale}
              point={splitPoint && splitTarget && !splitTarget.blocked ? splitPoint : null}
              target={splitTarget?.wire.points}
            />
          )}

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
              const d = placeOffset(
                attachPinouts(placing.parts),
                wirePointsOf(placing),
                mouse ?? toWorld(view, center()),
                sheet,
              );
              return (
                <g className={styles.ghost} transform={`translate(${d.x} ${d.y})`}>
                  {placing.wires.map((w) => (
                    <path key={w.id} className={styles.wire} d={wirePath(w.points, roundWires)} />
                  ))}
                  {placing.parts.map((c) => {
                    const pinout = getPinout(c, project);
                    return (
                      <SheetPart
                        key={c.id}
                        comp={c}
                        pinout={pinout}
                        name={c.kind === 'module' ? findDef(project, c.module)?.name : undefined}
                        outputValues={Array.from(
                          { length: Math.max(pinout.outputs.length, 1) },
                          () => false,
                        )}
                        inputValues={pinout.inputs.map(() => false)}
                        selected
                        onBodyDown={() => {}}
                        onBodyDoubleClick={() => {}}
                      />
                    );
                  })}
                </g>
              );
            })()}

          {/* 配線中の仮の線。置いた点に、今クリックしたら置かれる点を足して描く */}
          {pending && cursor && (
            <path className={styles.pending} d={wirePath([...pending, cursor], roundWires)} />
          )}

          {/* 配線モードでは、クリックで点が置かれる位置に印を出す */}
          {cursor && <circle className={styles.cursor} cx={cursor.x} cy={cursor.y} r={4} />}
        </g>
      </svg>
      {/* 右下に重ねる。削除エリアはズームのパネルの上 */}
      <Stack
        position="absolute"
        right="3"
        bottom="3"
        align="flex-end"
        gap="3"
        // 入れ物の空いている所は、シートの操作を素通しにする (丸とズームのパネルだけが受ける)
        pointerEvents="none"
      >
        {/* 配線の端のドラッグでは削除しないので、削除エリアは反応させない */}
        <TrashZone dragMode={dragMode === 'wireEnd' ? 'none' : dragMode} ref={trashRef} />
        <ZoomControls
          scale={view.scale}
          onZoomIn={zoom.in}
          onZoomOut={zoom.out}
          onReset={zoom.reset}
          onFit={zoom.fit}
        />
      </Stack>
    </div>
  );
}

/**
 * 分割モードの印。分かれ目 (2 本の端だけが合わさっている点) と、ポインターの下の分ける点に、
 * 線に直角の短い線を描く。分けた 2 本は 1 本に見えるので、どこで分けたかを確かめられるようにする
 */
function SplitMarks({
  wires,
  pinTips,
  scale,
  point,
  target,
}: {
  wires: readonly Wire[];
  pinTips: ReadonlySet<string>;
  scale: number;
  /** ポインターの下の分ける点。分けられないか、配線がなければ null */
  point: Point | null;
  /** 分ける配線の点の並び (印の向きに使う) */
  target: readonly Point[] | undefined;
}) {
  const joints = useMemo(() => findWireJoints(wires, pinTips), [wires, pinTips]);
  return (
    <>
      {joints.map(({ at, horizontal }) => (
        <path
          key={`${at.x},${at.y}`}
          className={styles.splitJoint}
          vectorEffect="non-scaling-stroke"
          d={tickPath(at, horizontal, JOINT_MARK / scale)}
        />
      ))}
      {point && target && (
        <path
          className={styles.splitCursor}
          vectorEffect="non-scaling-stroke"
          d={tickPath(point, isHorizontalAt(target, point), SPLIT_MARK / scale)}
        />
      )}
    </>
  );
}
