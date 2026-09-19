import { useEffect, useMemo, useRef, useState } from 'react';
import clearIcon from '../assets/icons/clear.svg';
import plusIcon from '../assets/icons/plus.svg';
import redoIcon from '../assets/icons/redo.svg';
import undoIcon from '../assets/icons/undo.svg';
import logo from '../assets/logo.svg';
import { Sheet, type SheetSize, type DragMode, type Selection } from '../components/Sheet';
import { Dialog, PromptDialog, type DialogRequest, type PromptRequest } from '../components/Dialogs';
import { MaskIcon } from '../components/Icons';
import { Palette, type PaletteModule } from '../components/Palette';
import { StatusBar } from '../components/StatusBar';
import { TabBar } from '../components/TabBar';
import { clampPosition, GRID, snap, type Point } from '../engine/geometry';
import { dependsOn, findDef, MAIN_ID, portsOf, simulateCircuit, type CircuitDef } from '../engine/project';
import type { Component, Kind, PinRef, SimResult } from '../engine/sim';
import { statusHints } from './hints';
import { loadProject, saveProject } from './storage';
import { useClock } from './useClock';
import { useProjectHistory } from './useProjectHistory';

/** その場で編集中の名前。tab はモジュール名、label は INPUT / OUTPUT のラベル */
type Editing = { type: 'tab' | 'label'; id: string } | null;

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function App() {
  const history = useProjectHistory(loadProject);
  const project = history.project;
  /** 元に戻せる編集としてプロジェクトを更新する */
  const setProject = history.commit;
  const [currentId, setCurrentId] = useState(MAIN_ID);
  const [selection, setSelection] = useState<Selection>(null);
  const [pending, setPending] = useState<PinRef | null>(null);
  const trashRef = useRef<HTMLDivElement>(null);
  const [dragMode, setDragMode] = useState<DragMode>('none');
  /** クリックで部品を追加するとき、はみ出さない位置に置くために使う */
  const [sheetSize, setSheetSize] = useState<SheetSize>({ width: Infinity, height: Infinity });
  const [editing, setEditing] = useState<Editing>(null);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [promptDialog, setPromptDialog] = useState<PromptRequest | null>(null);
  /** 回路ごとの前回のシミュレーション結果 */
  const prevResults = useRef(new Map<string, SimResult>());

  const circuit = findDef(project, currentId) ?? project.circuits[0];

  /** 開いている回路を更新する。record を false にすると元に戻す対象にしない */
  function setCircuit(update: (c: CircuitDef) => CircuitDef, record = true) {
    const id = circuit.id;
    (record ? history.commit : history.replace)((p) => ({
      circuits: p.circuits.map((d) => (d.id === id ? update(d) : d)),
    }));
  }

  const sim = useMemo(
    () => simulateCircuit(project, circuit.id, prevResults.current.get(circuit.id)),
    [project, circuit.id],
  );
  useEffect(() => {
    prevResults.current.set(circuit.id, sim);
  }, [sim, circuit.id]);

  useClock(project, history.replace);
  useEffect(() => saveProject(project), [project]);

  const compMap = useMemo(() => new Map(circuit.components.map((c) => [c.id, c])), [circuit]);

  /** パネルに並べるモジュール。今の回路に置けないもの (循環するもの) は理由付き */
  const paletteModules: PaletteModule[] = project.circuits
    .filter((d) => d.id !== MAIN_ID)
    .map((d) => ({
      def: d,
      blocked:
        d.id === circuit.id
          ? 'モジュールの中に自分自身は置けません'
          : dependsOn(project, d.id, circuit.id)
            ? `「${d.name}」はこの回路を含んでいるため置けません`
            : undefined,
    }));

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
    Object.assign(c, clampPosition(c, portsOf(c, project), c, sheetSize.width, sheetSize.height));
    setCircuit((cur) => ({ ...cur, components: [...cur.components, c] }));
    setSelection({ type: 'comp', id: c.id });
  }

  /** 部品と、それにつながる配線を削除する */
  function deleteComponent(id: string, record = true) {
    setCircuit(
      (cur) => ({
        ...cur,
        components: cur.components.filter((c) => c.id !== id),
        wires: cur.wires.filter((w) => w.from.comp !== id && w.to.comp !== id),
      }),
      record,
    );
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
    const users = project.circuits.filter((d) =>
      d.components.some((c) => c.kind === 'CUSTOM' && c.custom === circuit.id),
    );
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
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (dialog || promptDialog || typing) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && (key === 'z' || key === 'y')) {
        e.preventDefault();
        if (key === 'y' || e.shiftKey) redoEdit();
        else undoEdit();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelection();
      if (e.key === 'Escape') {
        setPending(null);
        setSelection(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** 選択や編集中の状態は、戻した先に存在しないことがあるので解除する */
  function resetInteraction() {
    setSelection(null);
    setPending(null);
    setEditing(null);
  }

  function undoEdit() {
    // ドラッグ中は、ドラッグの開始時点との整合が崩れるので受け付けない
    if (dragMode !== 'none') return;
    history.undo();
    resetInteraction();
  }

  function redoEdit() {
    if (dragMode !== 'none') return;
    history.redo();
    resetInteraction();
  }

  function onCompDoubleClick(c: Component) {
    if (c.kind === 'CUSTOM' && c.custom && findDef(project, c.custom)) {
      openCircuit(c.custom);
    } else if (c.kind === 'INPUT' || c.kind === 'OUTPUT') {
      setEditing({ type: 'label', id: c.id });
    }
  }

  function moveComponent(id: string, { x, y }: Point) {
    // ドラッグ中の移動は履歴に積まない。ドラッグの開始時に積んだ1回分で元に戻す
    setCircuit((cur) => ({ ...cur, components: cur.components.map((k) => (k.id === id ? { ...k, x, y } : k)) }), false);
  }

  function toggleInput(id: string) {
    // スイッチ操作は回路の編集ではないので、元に戻す対象にしない
    setCircuit(
      (cur) => ({ ...cur, components: cur.components.map((k) => (k.id === id ? { ...k, on: !k.on } : k)) }),
      false,
    );
  }

  /** 入力ピンにつなげる配線は1本だけなので、既存の配線は置き換える */
  function connect(from: PinRef, to: PinRef) {
    setCircuit((cur) => ({
      ...cur,
      wires: [...cur.wires.filter((w) => !(w.to.comp === to.comp && w.to.pin === to.pin)), { id: newId(), from, to }],
    }));
  }

  function disconnect(to: PinRef) {
    setCircuit((cur) => ({ ...cur, wires: cur.wires.filter((w) => !(w.to.comp === to.comp && w.to.pin === to.pin)) }));
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

  const hints = statusHints({
    dragMode,
    wiring: !!pending,
    editing: !!editing,
    wireSelected: selection?.type === 'wire',
    selectedComponent: selection?.type === 'comp' ? compMap.get(selection.id) : undefined,
    unstable: sim.unstable,
    inModule: circuit.id !== MAIN_ID,
  });

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <MaskIcon src={logo} className="logo" />
          <span className="visually-hidden">sazanka</span>
        </h1>
      </header>
      <TabBar
        circuits={project.circuits}
        currentId={circuit.id}
        renamingId={editing?.type === 'tab' ? editing.id : undefined}
        onOpen={openCircuit}
        onStartRename={(id) => setEditing({ type: 'tab', id })}
        onRename={renameCircuit}
        onCancelRename={() => setEditing(null)}
        onDeleteCurrent={deleteCircuit}
      />
      <div className="toolbar actions">
        <button className="tool" onClick={undoEdit} disabled={!history.canUndo} title="元に戻す (Ctrl+Z)">
          <MaskIcon src={undoIcon} className="tool-icon" />
          元に戻す
        </button>
        <button
          className="tool"
          onClick={redoEdit}
          disabled={!history.canRedo}
          title="やり直し (Ctrl+Shift+Z / Ctrl+Y)"
        >
          <MaskIcon src={redoIcon} className="tool-icon" />
          やり直し
        </button>
        <span className="divider" />
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
        <Palette
          modules={paletteModules}
          dragMode={dragMode}
          trashRef={trashRef}
          onAdd={(kind, custom) => addComponent(kind, custom)}
        />
        <Sheet
          project={project}
          circuit={circuit}
          sim={sim}
          selection={selection}
          onSelect={setSelection}
          pending={pending}
          onPendingChange={setPending}
          dragMode={dragMode}
          onDragModeChange={setDragMode}
          labelEditingId={editing?.type === 'label' ? editing.id : undefined}
          trashRef={trashRef}
          onResize={setSheetSize}
          onAdd={addComponent}
          onMoveStart={history.checkpoint}
          onMove={moveComponent}
          // 移動してから削除エリアに来た場合は、移動と削除をまとめて1回の操作にする
          onDropOnTrash={(id, moved) => deleteComponent(id, !moved)}
          onToggle={toggleInput}
          onConnect={connect}
          onDisconnect={disconnect}
          onComponentDoubleClick={onCompDoubleClick}
          onLabelCommit={setLabel}
          onLabelCancel={() => setEditing(null)}
        />
      </div>
      <StatusBar hints={hints} unstable={sim.unstable} />
      {dialog && <Dialog request={dialog} onClose={() => setDialog(null)} />}
      {promptDialog && <PromptDialog request={promptDialog} onClose={() => setPromptDialog(null)} />}
    </div>
  );
}
