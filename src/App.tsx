import { useEffect, useMemo, useRef, useState } from 'react';
import { ComponentView, LABELS } from './ComponentView';
import { Dialog, InlineInput, PromptDialog, type DialogRequest, type PromptRequest } from './Dialogs';
import clearIcon from './assets/icons/clear.svg';
import logo from './assets/logo.svg';
import plusIcon from './assets/icons/plus.svg';
import renameIcon from './assets/icons/rename.svg';
import trashIcon from './assets/icons/trash.svg';
import { MaskIcon, PartIcon } from './PartIcon';
import { bodySize, clampPosition, GRID, inputPinPos, outputPinPos, snap, type Point } from './geometry';
import {
  dependsOn,
  emptyProject,
  findDef,
  MAIN_ID,
  portsOf,
  simulateCircuit,
  type CircuitDef,
  type Project,
} from './project';
import { pinKey, type Circuit, type Component, type Kind, type PinRef, type SimResult } from './sim';

const PALETTE: { title: string; kinds: Kind[] }[] = [
  { title: '入出力', kinds: ['INPUT', 'CLOCK', 'OUTPUT'] },
  { title: '論理ゲート', kinds: ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR'] },
  { title: 'フリップフロップ', kinds: ['SR', 'DFF', 'TFF', 'JKFF'] },
];
/** パレットからドラッグするときの dataTransfer の型 */
const DRAG_MIME = 'application/x-sazanka-part';
const STORAGE_KEY = 'sazanka.project';
/** 旧形式 (回路1つ) の保存キー */
const LEGACY_STORAGE_KEY = 'sazanka.circuit';
/** ヒントを表示し続ける時間 (ms)。長い文ほど長く、最短でも HINT_MIN_DURATION */
function hintDuration(hint: string): number {
  return Math.max(HINT_MIN_DURATION, 3000 + hint.length * 250);
}
const HINT_MIN_DURATION = 6000;
/** 何も操作していないときに順に表示するヒント */
const IDLE_HINTS = [
  '左のパネルからクリックかドラッグで部品を追加',
  '出力ピン → 入力ピンの順にクリックで配線',
  '配線がつながった入力ピンをクリックすると配線を外す',
  'INPUT はクリックで ON/OFF を切り替え',
  '入力ピンにつなげる配線は1本だけ。別の配線をつなぐと置き換わる',
  '部品を左下の削除エリアへドラッグすると削除',
  'フリップフロップ (SR 以外) は、CLK (>) が OFF から ON になった瞬間だけ動く',
  '「モジュールを追加」で回路を部品としてまとめられる',
  'モジュールの中の INPUT / OUTPUT がピンになる。ダブルクリックでラベルを付けるとピン名になる',
];
/** モジュールのタブを開いているときに追加で表示するヒント */
const MODULE_HINTS = [
  'このモジュールの INPUT / OUTPUT が、外側から見たピンになる (上から順)',
  'INPUT / OUTPUT の上下の並びを変えるとピンの順番も変わり、外側の配線が別のピンにつながるので注意',
  'モジュールのタブを開いている間は、メイン回路のシミュレーションは止まる',
];
/** CLOCK が反転する間隔 (ms) */
const CLOCK_HALF_PERIOD = 500;

type Selection = { type: 'comp' | 'wire'; id: string } | null;
/** その場で編集中の名前。tab はモジュール名、label は INPUT / OUTPUT のラベル */
type Editing = { type: 'tab' | 'label'; id: string } | null;

interface Drag {
  id: string;
  offset: Point;
  moved: boolean;
  pointerId: number;
  /** 押した位置 (クライアント座標) */
  start: Point;
}

/** 押した位置からこれ以上動いたらドラッグとみなす (px) */
const DRAG_THRESHOLD = 4;

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function loadProject(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Project;
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const project = emptyProject();
      Object.assign(project.circuits[0], JSON.parse(legacy) as Circuit);
      return project;
    }
  } catch {
    // 読み込めなければ空のプロジェクトから始める
  }
  return emptyProject();
}

function wirePath(a: Point, b: Point): string {
  const mid = snap((a.x + b.x) / 2);
  return `M${a.x},${a.y} H${mid} V${b.y} H${b.x}`;
}

export function App() {
  const [project, setProject] = useState<Project>(loadProject);
  const [currentId, setCurrentId] = useState(MAIN_ID);
  const [selection, setSelection] = useState<Selection>(null);
  const [pending, setPending] = useState<PinRef | null>(null);
  const [mouse, setMouse] = useState<Point>({ x: 0, y: 0 });
  const dragRef = useRef<Drag | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const trashRef = useRef<HTMLDivElement>(null);
  /** 部品をドラッグ中か。'trash' は削除エリアの上 (離すと削除) */
  const [dragMode, setDragMode] = useState<'none' | 'moving' | 'trash'>('none');
  const [editing, setEditing] = useState<Editing>(null);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [promptDialog, setPromptDialog] = useState<PromptRequest | null>(null);
  /** 回路ごとの前回のシミュレーション結果 */
  const prevResults = useRef(new Map<string, SimResult>());

  const circuit = findDef(project, currentId) ?? project.circuits[0];

  function setCircuit(update: (c: CircuitDef) => CircuitDef) {
    setProject((p) => ({ circuits: p.circuits.map((d) => (d.id === circuit.id ? update(d) : d)) }));
  }

  const sim = useMemo(
    () => simulateCircuit(project, circuit.id, prevResults.current.get(circuit.id)),
    [project, circuit.id],
  );
  useEffect(() => {
    prevResults.current.set(circuit.id, sim);
  }, [sim, circuit.id]);

  const hasClock = project.circuits.some((d) => d.components.some((c) => c.kind === 'CLOCK'));
  useEffect(() => {
    if (!hasClock) return;
    const timer = setInterval(() => {
      setProject((p) => ({
        circuits: p.circuits.map((d) => ({
          ...d,
          components: d.components.map((c) => (c.kind === 'CLOCK' ? { ...c, on: !c.on } : c)),
        })),
      }));
    }, CLOCK_HALF_PERIOD);
    return () => clearInterval(timer);
  }, [hasClock]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch {
      // 保存できない環境では無視
    }
  }, [project]);

  const compMap = useMemo(() => new Map(circuit.components.map((c) => [c.id, c])), [circuit]);

  /** 今の回路に配置できるモジュール (自分自身を含むものは除く) */
  const usableModules = project.circuits.filter(
    (d) => d.id !== MAIN_ID && d.id !== circuit.id && !dependsOn(project, d.id, circuit.id),
  );

  function toLocal(e: { clientX: number; clientY: number }): Point {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /** 部品がキャンバスからはみ出さない位置に補正する */
  function clampToCanvas(c: Component, p: Point): Point {
    const rect = svgRef.current!.getBoundingClientRect();
    return clampPosition(c, portsOf(c, project), p, rect.width, rect.height);
  }

  function openCircuit(id: string) {
    setCurrentId(id);
    setSelection(null);
    setPending(null);
  }

  /** 部品を追加する。位置を省略すると少しずつずらして置く */
  function addComponent(kind: Kind, custom?: string, at?: Point) {
    const n = circuit.components.length;
    const c: Component = {
      id: newId(),
      kind,
      x: at ? snap(at.x) : 100 + (n % 10) * GRID,
      y: at ? snap(at.y) : 80 + (n % 10) * GRID,
    };
    if (kind === 'INPUT' || kind === 'CLOCK') c.on = false;
    if (custom) c.custom = custom;
    Object.assign(c, clampToCanvas(c, c));
    setCircuit((cur) => ({ ...cur, components: [...cur.components, c] }));
    setSelection({ type: 'comp', id: c.id });
  }

  /** 部品と、それにつながる配線を削除する */
  function deleteComponent(id: string) {
    setCircuit((cur) => ({
      ...cur,
      components: cur.components.filter((c) => c.id !== id),
      wires: cur.wires.filter((w) => w.from.comp !== id && w.to.comp !== id),
    }));
    setSelection(null);
  }

  function deleteSelection() {
    if (!selection) return;
    if (selection.type === 'comp') {
      deleteComponent(selection.id);
      return;
    }
    setCircuit((cur) => ({ ...cur, wires: cur.wires.filter((w) => w.id !== selection.id) }));
    setSelection(null);
  }

  /** 名前を入力するウィンドウを開き、確定したらモジュールを作成して開く */
  function createModule() {
    const names = new Set(project.circuits.map((d) => d.name));
    let n = project.circuits.length;
    while (names.has(`モジュール${n}`)) n++;
    setPromptDialog({
      title: 'モジュールを追加',
      label: '名前',
      initial: `モジュール${n}`,
      confirmLabel: '追加',
      validate: (name) =>
        !name ? '名前を入力してください' : names.has(name) ? '同じ名前の回路がすでにあります' : undefined,
      onSubmit: (name) => {
        const def: CircuitDef = { id: newId(), name, components: [], wires: [] };
        setProject((p) => ({ circuits: [...p.circuits, def] }));
        openCircuit(def.id);
      },
    });
  }

  function renameCircuit(id: string, value: string) {
    const name = value.trim();
    setEditing(null);
    if (!name) return;
    setProject((p) => ({ circuits: p.circuits.map((d) => (d.id === id ? { ...d, name } : d)) }));
  }

  function deleteCircuit() {
    const users = project.circuits.filter((d) => d.components.some((c) => c.kind === 'CUSTOM' && c.custom === circuit.id));
    if (users.length > 0) {
      setDialog({
        message: `「${circuit.name}」は次の回路で使われているため削除できません: ${users.map((d) => d.name).join(', ')}`,
      });
      return;
    }
    const id = circuit.id;
    setDialog({
      message: `モジュール「${circuit.name}」を削除しますか？`,
      confirmLabel: '削除',
      danger: true,
      onConfirm: () => {
        setProject((p) => ({ circuits: p.circuits.filter((d) => d.id !== id) }));
        prevResults.current.delete(id);
        openCircuit(MAIN_ID);
      },
    });
  }

  function setLabel(id: string, value: string) {
    setEditing(null);
    setCircuit((cur) => ({
      ...cur,
      components: cur.components.map((k) => (k.id === id ? { ...k, label: value.trim() || undefined } : k)),
    }));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // 文字入力中やダイアログ表示中は、キーを編集操作として扱わない
      if (dialog || promptDialog || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelection();
      if (e.key === 'Escape') {
        setPending(null);
        setSelection(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function onCompPointerDown(e: React.PointerEvent, c: Component) {
    e.stopPropagation();
    const p = toLocal(e);
    dragRef.current = { id: c.id, offset: { x: p.x - c.x, y: p.y - c.y }, moved: false, pointerId: e.pointerId, start: { x: e.clientX, y: e.clientY } };
    setSelection({ type: 'comp', id: c.id });
  }

  function onCompDoubleClick(c: Component) {
    if (c.kind === 'CUSTOM' && c.custom && findDef(project, c.custom)) {
      openCircuit(c.custom);
    } else if (c.kind === 'INPUT' || c.kind === 'OUTPUT') {
      setEditing({ type: 'label', id: c.id });
    }
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
      // キャンバスの外 (削除エリアの上など) に出ても移動イベントを受け取り続ける。
      // 押した時点でキャプチャすると、クリックやダブルクリックが部品に届かなくなるため、ドラッグが始まってから行う
      svg.setPointerCapture(drag.pointerId);
    }
    const rect = trashRef.current?.getBoundingClientRect();
    const overTrash =
      !!rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (overTrash) {
      // 削除エリアの上では部品は動かさない
      drag.moved = true;
      setDragMode('trash');
      return;
    }
    if (drag.moved) setDragMode('moving');
    const c = compMap.get(drag.id);
    if (!c) return;
    const { x, y } = clampToCanvas(c, { x: snap(p.x - drag.offset.x), y: snap(p.y - drag.offset.y) });
    if (c.x === x && c.y === y) return;
    drag.moved = true;
    setDragMode('moving');
    setCircuit((cur) => ({
      ...cur,
      components: cur.components.map((k) => (k.id === drag.id ? { ...k, x, y } : k)),
    }));
  }

  function onPointerUp() {
    const drag = dragRef.current;
    const mode = dragMode;
    dragRef.current = null;
    setDragMode('none');
    if (!drag) return;
    if (mode === 'trash') {
      deleteComponent(drag.id);
      return;
    }
    if (drag.moved) return;
    // 動かさずに離したスイッチはトグル
    const c = compMap.get(drag.id);
    if (c?.kind === 'INPUT') {
      setCircuit((cur) => ({
        ...cur,
        components: cur.components.map((k) => (k.id === c.id ? { ...k, on: !k.on } : k)),
      }));
    }
  }

  function onOutputPinDown(e: React.PointerEvent, c: Component, pin: number) {
    e.stopPropagation();
    setPending({ comp: c.id, pin });
  }

  function onInputPinDown(e: React.PointerEvent, c: Component, pin: number) {
    e.stopPropagation();
    if (!pending) {
      // 入力ピンから始めた場合は既存の配線を外す
      setCircuit((cur) => ({
        ...cur,
        wires: cur.wires.filter((w) => !(w.to.comp === c.id && w.to.pin === pin)),
      }));
      return;
    }
    const from = pending;
    setPending(null);
    setCircuit((cur) => ({
      ...cur,
      wires: [
        // 入力ピンに接続できる配線は1本だけ
        ...cur.wires.filter((w) => !(w.to.comp === c.id && w.to.pin === pin)),
        { id: newId(), from, to: { comp: c.id, pin } },
      ],
    }));
  }

  function onDrop(e: React.DragEvent) {
    const data = e.dataTransfer.getData(DRAG_MIME);
    if (!data) return;
    e.preventDefault();
    const { kind, custom } = JSON.parse(data) as { kind: Kind; custom?: string };
    const p = toLocal(e);
    // カーソルが部品の左上付近に来るよう少しずらす
    addComponent(kind, custom, { x: p.x - GRID, y: p.y - GRID });
  }

  function onBackgroundDown() {
    setPending(null);
    setSelection(null);
  }

  function clearAll() {
    setDialog({
      message: 'この回路をすべて消去しますか？',
      confirmLabel: '消去',
      danger: true,
      onConfirm: () => {
        setCircuit((cur) => ({ ...cur, components: [], wires: [] }));
        setSelection(null);
        setPending(null);
      },
    });
  }

  /** ステータスバーに出す、今の操作に応じた使い方のヒント。複数あれば時間で切り替える */
  function statusHints(): string[] {
    if (dragMode === 'trash') return ['離すと削除します'];
    if (dragMode === 'moving') return ['左下の削除エリアで離すと削除します'];
    if (pending) return ['接続先の入力ピンをクリック ・ Esc で取り消し'];
    if (editing) return ['Enter で確定 ・ Esc で取り消し'];
    if (selection?.type === 'wire') return ['Delete で配線を削除'];
    const c = selection?.type === 'comp' ? compMap.get(selection.id) : undefined;
    if (c) {
      const move = ['ドラッグで移動', 'Delete か、左下の削除エリアへドラッグで削除'];
      if (c.kind === 'INPUT') return ['クリックで ON/OFF', 'ダブルクリックでラベルを編集', ...move];
      if (c.kind === 'OUTPUT') return ['ダブルクリックでラベルを編集', ...move];
      if (c.kind === 'CUSTOM') return ['ダブルクリックで中身を開く', 'ピンの並びは、中の INPUT / OUTPUT の上からの順', ...move];
      if (c.kind === 'CLOCK') return [`${(CLOCK_HALF_PERIOD * 2) / 1000} 秒周期で ON/OFF を繰り返す`, ...move];
      if (c.kind === 'SR') return ['S が ON で Q を ON、R が ON で Q を OFF にする (両方 ON なら OFF)', ...move];
      if (c.kind === 'DFF') return ['CLK (>) が OFF→ON になった瞬間の D を Q に取り込む', ...move];
      if (c.kind === 'TFF') return ['CLK (>) が OFF→ON になった瞬間、T が ON なら Q を反転する', ...move];
      if (c.kind === 'JKFF')
        return ['CLK (>) が OFF→ON になった瞬間に、J で ON、K で OFF、両方で反転する', ...move];
      return move;
    }
    if (sim.unstable) return ['発振中: 出力が自分の入力に戻るループで、値が決まらない状態になっている'];
    return circuit.id === MAIN_ID ? IDLE_HINTS : [...MODULE_HINTS, ...IDLE_HINTS];
  }

  const hints = statusHints();
  const hintKey = hints.join('|');
  const [hintIndex, setHintIndex] = useState(0);
  /** ステータスバーにマウスが載っている間は切り替えを止める */
  const [hintPaused, setHintPaused] = useState(false);
  // 状態が変わったら最初のヒントから表示し直す
  useEffect(() => setHintIndex(0), [hintKey]);
  const hint = hints[hintIndex % hints.length];
  // 読み終えられるだけの時間を置いてから次のヒントへ切り替える
  useEffect(() => {
    if (hints.length < 2 || hintPaused) return;
    const timer = setTimeout(() => setHintIndex((i) => i + 1), hintDuration(hint));
    return () => clearTimeout(timer);
  }, [hint, hintIndex, hints.length, hintPaused]);

  /** ラベル入力欄は部品の真上に置く */
  function labelInputPosition(c: Component): React.CSSProperties {
    const { w } = bodySize(c, portsOf(c, project));
    const width = 120;
    return { left: Math.max(0, c.x + w / 2 - width / 2), top: Math.max(0, c.y - 30), width };
  }

  const pendingFrom = pending && compMap.get(pending.comp);
  const labelTarget = editing?.type === 'label' ? compMap.get(editing.id) : undefined;

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <MaskIcon src={logo} className="logo" />
          <span className="visually-hidden">sazanka</span>
        </h1>
      </header>
      <div className="tabbar">
        <div className="tabs" role="tablist">
          {project.circuits.map((d) =>
            editing?.type === 'tab' && editing.id === d.id ? (
              <InlineInput
                key={d.id}
                className="tab-input"
                initial={d.name}
                onCommit={(v) => renameCircuit(d.id, v)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <button
                key={d.id}
                role="tab"
                aria-selected={d.id === circuit.id}
                className={`tab${d.id === circuit.id ? ' active' : ''}`}
                onClick={() => openCircuit(d.id)}
                onDoubleClick={() => d.id !== MAIN_ID && setEditing({ type: 'tab', id: d.id })}
                title={d.id !== MAIN_ID ? 'ダブルクリックで名前を変更' : undefined}
              >
                {d.name}
              </button>
            ),
          )}
        </div>
        {circuit.id !== MAIN_ID && (
          <div className="tabbar-actions">
            <button className="tool" onClick={() => setEditing({ type: 'tab', id: circuit.id })}>
              <MaskIcon src={renameIcon} className="tool-icon" />
              名前変更
            </button>
            <button className="tool" onClick={deleteCircuit}>
              <MaskIcon src={trashIcon} className="tool-icon" />
              モジュールを削除
            </button>
          </div>
        )}
      </div>
      <div className="toolbar actions">
        <button className="tool" onClick={createModule}>
          <MaskIcon src={plusIcon} className="tool-icon" />
          モジュールを追加
        </button>
        <button className="tool" onClick={clearAll} title="この回路をすべて消去">
          <MaskIcon src={clearIcon} className="tool-icon" />
          全消去
        </button>
      </div>
      <div className="workspace">
        <div className="sidebar">
          <aside className="palette">
            {PALETTE.map((group) => (
              <section key={group.title}>
                <h3>{group.title}</h3>
                {group.kinds.map((k) => (
                  <PaletteItem key={k} label={LABELS[k] ?? k} kind={k} onAdd={() => addComponent(k)} />
                ))}
              </section>
            ))}
            <section>
              <h3>モジュール</h3>
              {usableModules.map((d) => (
                <PaletteItem key={d.id} label={d.name} kind="CUSTOM" custom={d.id} onAdd={() => addComponent('CUSTOM', d.id)} />
              ))}
              {usableModules.length === 0 && <p className="empty">置けるモジュールはありません</p>}
            </section>
          </aside>
          <div
            ref={trashRef}
            className={`trash${dragMode !== 'none' ? ' dragging' : ''}${dragMode === 'trash' ? ' active' : ''}`}
          >
            <MaskIcon src={trashIcon} className="trash-icon" />
            ここへドラッグで削除
          </div>
        </div>
        <div className="canvas-wrap">
          <svg
            ref={svgRef}
            className="canvas"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              dragRef.current = null;
              setDragMode('none');
            }}
            onPointerDown={onBackgroundDown}
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
                  <path className={`wire${on ? ' on' : ''}${selected ? ' selected' : ''}`} d={d} />
                  <path
                    className="wire-hit"
                    d={d}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setSelection({ type: 'wire', id: w.id });
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
                  outputValues={Array.from({ length: Math.max(ports.outputs.length, 1) }, (_, i) =>
                    !!sim.values.get(pinKey(c.id, i)),
                  )}
                  inputValues={ports.inputs.map((_, i) => {
                    const w = circuit.wires.find((w) => w.to.comp === c.id && w.to.pin === i);
                    return w ? !!sim.values.get(pinKey(w.from.comp, w.from.pin)) : false;
                  })}
                  selected={selection?.type === 'comp' && selection.id === c.id}
                  onBodyDown={(e) => onCompPointerDown(e, c)}
                  onBodyDoubleClick={() => onCompDoubleClick(c)}
                  onInputPinDown={(e, pin) => onInputPinDown(e, c, pin)}
                  onOutputPinDown={(e, pin) => onOutputPinDown(e, c, pin)}
                />
              );
            })}

            {pending && pendingFrom && (
              <path
                className="pending"
                d={wirePath(outputPinPos(pendingFrom, portsOf(pendingFrom, project), pending.pin), mouse)}
              />
            )}
          </svg>
          {labelTarget && (
            <InlineInput
              key={labelTarget.id}
              className="label-input"
              style={labelInputPosition(labelTarget)}
              initial={labelTarget.label ?? ''}
              placeholder="ラベル"
              onCommit={(v) => setLabel(labelTarget.id, v)}
              onCancel={() => setEditing(null)}
            />
          )}
        </div>
      </div>
      <footer
        className="statusbar"
        onPointerEnter={() => setHintPaused(true)}
        onPointerLeave={() => setHintPaused(false)}
      >
        <span key={hint} className="status-hint">
          {hint}
        </span>
        {sim.unstable && <span className="status-warn">発振しています</span>}
      </footer>
      {dialog && <Dialog request={dialog} onClose={() => setDialog(null)} />}
      {promptDialog && <PromptDialog request={promptDialog} onClose={() => setPromptDialog(null)} />}
    </div>
  );
}

interface PaletteItemProps {
  label: string;
  kind: Kind;
  custom?: string;
  onAdd: () => void;
}

/** クリックで追加、キャンバスへドラッグで好きな位置に追加 */
function PaletteItem({ label, kind, custom, onAdd }: PaletteItemProps) {
  return (
    <button
      className={kind === 'CUSTOM' ? 'custom' : undefined}
      draggable
      onClick={onAdd}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ kind, custom }));
        e.dataTransfer.effectAllowed = 'copy';
      }}
    >
      <PartIcon kind={kind} />
      <span>{label}</span>
    </button>
  );
}
