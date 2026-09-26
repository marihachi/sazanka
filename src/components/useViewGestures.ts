import { useEffect, useRef, useState } from 'react';
import type { Point } from '../engine/layout';
import { type View, zoomAt } from './view';

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

/** ポインターの位置を、シートの左上からの画面の座標にする */
export function toScreenLocal(
  svg: SVGSVGElement,
  e: { clientX: number; clientY: number },
): Point {
  const rect = svg.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

interface ViewGesturesOptions {
  svgRef: React.RefObject<SVGSVGElement | null>;
  view: View;
  onViewChange: (view: View) => void;
  /** 2本目の指が触れた。1本目で始めていた部品のドラッグなどを打ち切る */
  onCancelGesture: () => void;
}

/**
 * シートの表示を動かす操作: ホイールでの拡大縮小、中ボタンか Space を押しながらのドラッグでの移動、2本指での移動と拡大縮小。
 * 返す startView / moveView / endView は、シートのポインターのイベントから呼び、表示の操作として扱ったら true を返す
 */
export function useViewGestures({
  svgRef,
  view,
  onViewChange,
  onCancelGesture,
}: ViewGesturesOptions) {
  /** シートの svg。イベントはシートが表示されてからしか起きないので、ハンドラーの中では必ずある */
  function sheetSvg(): SVGSVGElement {
    const svg = svgRef.current;
    if (!svg) {
      throw new Error('シートの svg がまだありません');
    }
    return svg;
  }
  const panRef = useRef<Pan | null>(null);
  const pinchRef = useRef<Pinch | null>(null);
  /** シートに触れている指 (pointerId → 画面の座標)。2本になったら移動と拡大縮小にする */
  const touchesRef = useRef(new Map<number, Point>());
  /** Space を押している間は、ドラッグで表示を移動する */
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);

  // ホイールの処理は一度だけ登録するので、呼び出し時点の最新の表示を ref から読む
  const viewRef = useRef(view);
  const onViewChangeRef = useRef(onViewChange);
  useEffect(() => {
    viewRef.current = view;
    onViewChangeRef.current = onViewChange;
  });

  // ホイールで拡大縮小する。トラックパッドのピンチも Ctrl 付きのホイールとして届く。
  // React の onWheel は passive で登録されて preventDefault できず、ページごと拡大されてしまうので、直接登録する
  // biome-ignore lint/correctness/useExhaustiveDependencies: svgRef は変わらず、最新の表示は ref から読むので、登録は一度だけでよい
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }
    // 関数宣言にすると、上で絞り込んだ svg の型が中に届かないので、関数式にする
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // 行単位で届く環境 (Firefox など) では、おおよそのピクセル数に直す
      const delta =
        e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 16 : e.deltaY;
      // ピンチは1回の量が小さいので、強めに効かせる
      const factor = Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0015));
      const v = viewRef.current;
      onViewChangeRef.current(
        zoomAt(v, toScreenLocal(svg, e), v.scale * factor),
      );
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  // Space を押している間は、ドラッグで表示を移動する
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code !== 'Space') {
        return;
      }
      const typing =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;
      if (typing) {
        return;
      }
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

  /**
   * 子要素 (部品やピン) より先に受け取り、表示の移動と拡大縮小を始める。
   * 始めた場合は子要素に届けず、部品のドラッグや配線が始まらないようにする
   */
  function startView(e: React.PointerEvent): boolean {
    const svg = sheetSvg();
    if (e.pointerType === 'touch') {
      const touches = touchesRef.current;
      touches.set(e.pointerId, toScreenLocal(svg, e));
      if (touches.size >= 2) {
        e.stopPropagation();
        if (touches.size === 2) {
          // 1本目の指で始めた操作はやめて、2本指の操作にする
          onCancelGesture();
          const [a, b] = [...touches.values()];
          pinchRef.current = {
            mid: midpoint(a, b),
            distance: Math.hypot(a.x - b.x, a.y - b.y),
            view,
          };
        }
        return true;
      }
    }
    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      e.stopPropagation();
      // 中ボタンを押したときの自動スクロールを出さない
      e.preventDefault();
      svg.setPointerCapture(e.pointerId);
      panRef.current = {
        pointerId: e.pointerId,
        start: toScreenLocal(svg, e),
        view,
      };
      setPanning(true);
      return true;
    }
    return false;
  }

  /** 表示の移動・拡大縮小の途中なら進めて true を返す */
  function moveView(e: React.PointerEvent): boolean {
    const svg = sheetSvg();
    const touches = touchesRef.current;
    if (touches.has(e.pointerId)) {
      touches.set(e.pointerId, toScreenLocal(svg, e));
    }
    const pinch = pinchRef.current;
    if (pinch) {
      if (touches.size < 2) {
        return true;
      }
      const [a, b] = [...touches.values()];
      const mid = midpoint(a, b);
      const scale =
        (pinch.view.scale * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.distance;
      // 押した時点で指の間にあった回路の点を、今の指の間に持ってくる
      const zoomed = zoomAt(pinch.view, pinch.mid, scale);
      onViewChange({
        ...zoomed,
        x: zoomed.x + mid.x - pinch.mid.x,
        y: zoomed.y + mid.y - pinch.mid.y,
      });
      return true;
    }
    const pan = panRef.current;
    if (pan && pan.pointerId === e.pointerId) {
      const p = toScreenLocal(svg, e);
      onViewChange({
        ...pan.view,
        x: pan.view.x + p.x - pan.start.x,
        y: pan.view.y + p.y - pan.start.y,
      });
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
      if (touches.size === 0) {
        pinchRef.current = null;
      }
      return true;
    }
    if (panRef.current?.pointerId === e.pointerId) {
      panRef.current = null;
      setPanning(false);
      return true;
    }
    return false;
  }

  return { spaceHeld, panning, startView, moveView, endView };
}
