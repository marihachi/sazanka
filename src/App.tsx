import { useEffect, useMemo, useRef, useState } from 'react';
import { ComponentView, LABELS } from './ComponentView';
import { GRID, inputPinPos, outputPinPos, snap, type Point } from './geometry';
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
/** CLOCK が反転する間隔 (ms) */
const CLOCK_HALF_PERIOD = 500;

type Selection = { type: 'comp' | 'wire'; id: string } | null;

interface Drag {
  id: string;
  offset: Point;
  moved: boolean;
}

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

  /** 今の回路に配置できるサブ回路 (自分自身を含むものは除く) */
  const usableSubs = project.circuits.filter(
    (d) => d.id !== MAIN_ID && d.id !== circuit.id && !dependsOn(project, d.id, circuit.id),
  );

  function toLocal(e: { clientX: number; clientY: number }): Point {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function openCircuit(id: string) {
    setCurrentId(id);
    setSelection(null);
    setPending(null);
  }

  /** 部品を追加する。位置を省略すると少しずつずらして置く */
  function addComponent(kind: Kind, sub?: string, at?: Point) {
    const n = circuit.components.length;
    const c: Component = {
      id: newId(),
      kind,
      x: at ? snap(at.x) : 100 + (n % 10) * GRID,
      y: at ? snap(at.y) : 80 + (n % 10) * GRID,
    };
    if (kind === 'INPUT' || kind === 'CLOCK') c.on = false;
    if (sub) c.sub = sub;
    setCircuit((cur) => ({ ...cur, components: [...cur.components, c] }));
    setSelection({ type: 'comp', id: c.id });
  }

  function deleteSelection() {
    if (!selection) return;
    setCircuit((cur) =>
      selection.type === 'comp'
        ? {
            ...cur,
            components: cur.components.filter((c) => c.id !== selection.id),
            wires: cur.wires.filter((w) => w.from.comp !== selection.id && w.to.comp !== selection.id),
          }
        : { ...cur, wires: cur.wires.filter((w) => w.id !== selection.id) },
    );
    setSelection(null);
  }

  function createSubcircuit() {
    const name = prompt('サブ回路の名前', `回路${project.circuits.length}`)?.trim();
    if (!name) return;
    const def: CircuitDef = { id: newId(), name, components: [], wires: [] };
    setProject((p) => ({ circuits: [...p.circuits, def] }));
    openCircuit(def.id);
  }

  function renameCircuit() {
    const name = prompt('サブ回路の名前', circuit.name)?.trim();
    if (!name) return;
    setCircuit((cur) => ({ ...cur, name }));
  }

  function deleteCircuit() {
    const users = project.circuits.filter((d) => d.components.some((c) => c.kind === 'SUB' && c.sub === circuit.id));
    if (users.length > 0) {
      alert(`「${circuit.name}」は次の回路で使われているため削除できません: ${users.map((d) => d.name).join(', ')}`);
      return;
    }
    if (!confirm(`サブ回路「${circuit.name}」を削除しますか？`)) return;
    const id = circuit.id;
    setProject((p) => ({ circuits: p.circuits.filter((d) => d.id !== id) }));
    prevResults.current.delete(id);
    openCircuit(MAIN_ID);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
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
    dragRef.current = { id: c.id, offset: { x: p.x - c.x, y: p.y - c.y }, moved: false };
    setSelection({ type: 'comp', id: c.id });
  }

  function onCompDoubleClick(c: Component) {
    if (c.kind === 'SUB' && c.sub && findDef(project, c.sub)) {
      openCircuit(c.sub);
    } else if (c.kind === 'INPUT' || c.kind === 'OUTPUT') {
      const label = prompt('ラベル', c.label ?? '');
      if (label === null) return;
      setCircuit((cur) => ({
        ...cur,
        components: cur.components.map((k) => (k.id === c.id ? { ...k, label: label.trim() || undefined } : k)),
      }));
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const p = toLocal(e);
    setMouse(p);
    const drag = dragRef.current;
    if (!drag) return;
    const x = snap(p.x - drag.offset.x);
    const y = snap(p.y - drag.offset.y);
    const c = compMap.get(drag.id);
    if (!c || (c.x === x && c.y === y)) return;
    drag.moved = true;
    setCircuit((cur) => ({
      ...cur,
      components: cur.components.map((k) => (k.id === drag.id ? { ...k, x, y } : k)),
    }));
  }

  function onPointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.moved) return;
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
    const { kind, sub } = JSON.parse(data) as { kind: Kind; sub?: string };
    const p = toLocal(e);
    // カーソルが部品の左上付近に来るよう少しずらす
    addComponent(kind, sub, { x: p.x - GRID, y: p.y - GRID });
  }

  function onBackgroundDown() {
    setPending(null);
    setSelection(null);
  }

  function clearAll() {
    if (!confirm('この回路をすべて消去しますか？')) return;
    setCircuit((cur) => ({ ...cur, components: [], wires: [] }));
    setSelection(null);
    setPending(null);
  }

  const pendingFrom = pending && compMap.get(pending.comp);

  return (
    <div className="app">
      <div className="toolbar tabs">
        {project.circuits.map((d) => (
          <button key={d.id} className={d.id === circuit.id ? 'active' : undefined} onClick={() => openCircuit(d.id)}>
            {d.name}
          </button>
        ))}
        <button onClick={createSubcircuit}>+ サブ回路</button>
        {circuit.id !== MAIN_ID && (
          <>
            <span className="sep" />
            <button onClick={renameCircuit}>名前変更</button>
            <button onClick={deleteCircuit}>サブ回路を削除</button>
          </>
        )}
      </div>
      <div className="toolbar">
        <button onClick={deleteSelection} disabled={!selection}>
          削除
        </button>
        <button onClick={clearAll}>全消去</button>
        <span className="sep" />
        {sim.unstable && <span className="warn">発振しています</span>}
        <span className="hint">
          部品は左のパネルからクリックかドラッグで追加 / 出力ピン→入力ピンをクリックで配線 / スイッチはクリックで切替 / ダブルクリックでラベル編集・サブ回路を開く / Delete で削除
        </span>
      </div>
      <div className="workspace">
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
            <h3>サブ回路</h3>
            {usableSubs.map((d) => (
              <PaletteItem key={d.id} label={d.name} kind="SUB" sub={d.id} onAdd={() => addComponent('SUB', d.id)} />
            ))}
            {usableSubs.length === 0 && <p className="empty">置けるサブ回路はありません</p>}
          </section>
        </aside>
        <svg
          ref={svgRef}
          className="canvas"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => (dragRef.current = null)}
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
            // サブ回路のピンが減った場合など、存在しないピンへの配線は描かない
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
                name={c.kind === 'SUB' ? findDef(project, c.sub)?.name : undefined}
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
      </div>
    </div>
  );
}

interface PaletteItemProps {
  label: string;
  kind: Kind;
  sub?: string;
  onAdd: () => void;
}

/** クリックで追加、キャンバスへドラッグで好きな位置に追加 */
function PaletteItem({ label, kind, sub, onAdd }: PaletteItemProps) {
  return (
    <button
      className={kind === 'SUB' ? 'sub' : undefined}
      draggable
      onClick={onAdd}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ kind, sub }));
        e.dataTransfer.effectAllowed = 'copy';
      }}
    >
      {label}
    </button>
  );
}
