import { useEffect, useRef, useState } from 'react';
import { Sheet, type SheetSize, type DragMode, type Selection } from '../components/Sheet';
import {
  AboutDialog,
  Dialog,
  PromptDialog,
  TextDialog,
  type DialogRequest,
  type PromptRequest,
  type TextRequest,
} from '../components/Dialogs';
import { Header } from '../components/Header';
import { Palette, type PaletteModule } from '../components/Palette';
import { StatusBar } from '../components/StatusBar';
import { TabBar } from '../components/TabBar';
import { Toolbar } from '../components/Toolbar';
import { overview, toWorld } from '../components/view';
import * as edit from '../engine/edit';
import { clampPosition, GRID, Point, snap } from '../engine/layout';
import type { Component, ComponentKind } from '../engine/component';
import { newId, type Circuit, type PinRef } from '../engine/circuit';
import { emptyProject, findDef, MAIN_ID, moveCircuit, type CircuitDef, type Project } from '../engine/project';
import { circuitsUsing, dependsOn, portsOf } from '../engine/module';
import { parseProject, serializeProject } from '../engine/share';

import { statusHints } from './hints';
import { loadCollapsedGroups, loadProject, loadViews, saveCollapsedGroups, saveProject, saveViews } from './storage';
import { useSimulation } from './useSimulation';
import { useProjectHistory } from './useProjectHistory';
import { useShortcuts } from './useShortcuts';

/** その場で編集中の名前。tab はモジュール名、label は INPUT / OUTPUT のラベル */
type Editing = { type: 'tab' | 'label'; id: string } | null;

export function App() {
  const [loaded] = useState(loadProject);
  const history = useProjectHistory(() => loaded.project);
  const project = history.project;
  /** 元に戻せる編集としてプロジェクトを更新する */
  const setProject = history.commit;
  const [currentId, setCurrentId] = useState(MAIN_ID);
  const [selection, setSelection] = useState<Selection>(null);
  const [pending, setPending] = useState<PinRef | null>(null);
  const trashRef = useRef<HTMLDivElement>(null);
  const [dragMode, setDragMode] = useState<DragMode>('none');
  /** クリックで部品を追加するとき、表示している範囲の真ん中に置くために使う */
  const [sheetSize, setSheetSize] = useState<SheetSize>({ width: 0, height: 0 });
  /** 回路ごとの表示位置と倍率。元に戻す対象にはしない */
  const [views, setViews] = useState(loadViews);
  /** コピーした部品と配線 */
  const [clipboard, setClipboard] = useState<Circuit | null>(null);
  /** 貼り付ける位置を選んでいる部品と配線。クリックした位置で確定する */
  const [placing, setPlacing] = useState<Circuit | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [dialog, setDialog] = useState<DialogRequest | null>(() =>
    loaded.error ? { message: `${loaded.error}空のプロジェクトで開きます。` } : null,
  );
  const [promptDialog, setPromptDialog] = useState<PromptRequest | null>(null);
  const [textDialog, setTextDialog] = useState<TextRequest | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(loadCollapsedGroups);
  const circuit = findDef(project, currentId) ?? project.circuits[0];
  // 表示を保存していない回路は、回路全体が見える表示で開く
  const view = views[circuit.id] ?? overview(circuit, project, sheetSize.width, sheetSize.height);

  /** 開いている回路を更新する。record を false にすると元に戻す対象にしない */
  function setCircuit(update: (c: CircuitDef) => CircuitDef, record = true) {
    const id = circuit.id;
    (record ? history.commit : history.replace)((p) => ({
      circuits: p.circuits.map((d) => (d.id === id ? update(d) : d)),
    }));
  }

  const { sim, running, toggleRunning, stepOnce, stepBack, canStepBack, forget } = useSimulation(
    project,
    circuit.id,
    history.replace,
  );
  useEffect(() => saveProject(project), [project]);
  useEffect(() => saveCollapsedGroups(collapsedGroups), [collapsedGroups]);
  useEffect(() => saveViews(views), [views]);
  // 表示を保存していない回路は、開いた時点の表示をすぐに保存して固定する。
  // 固定しないと、部品を置くたびに「回路全体が見える表示」が計算し直され、画面が勝手に動いてしまう
  const viewSaved = circuit.id in views;
  const sheetReady = sheetSize.width > 0 && sheetSize.height > 0;
  useEffect(() => {
    if (!viewSaved && sheetReady) setViews((vs) => ({ ...vs, [circuit.id]: view }));
  }, [viewSaved, sheetReady, circuit.id, view]);

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
    setPlacing(null);
    setCurrentId(id);
    setSelection(null);
    setPending(null);
  }

  /** 部品を追加する。位置を省略すると、表示している範囲の真ん中あたりに、重ならないよう少しずつずらして置く */
  function addComponent(kind: ComponentKind, custom?: string, at?: Point) {
    const n = circuit.components.length;
    const center = toWorld(view, { x: sheetSize.width / 2, y: sheetSize.height / 2 });
    const base = at ?? { x: center.x - GRID * 2 + (n % 10) * GRID, y: center.y - GRID * 2 + (n % 10) * GRID };
    const c: Component = { id: newId(), kind, x: snap(base.x), y: snap(base.y) };
    if (kind === 'INPUT' || kind === 'CLOCK') c.on = false;
    if (custom) c.custom = custom;
    Object.assign(c, clampPosition(c, portsOf(c, project), c));
    setCircuit((cur) => edit.addComponent(cur, c));
    setSelection({ type: 'comp', ids: [c.id] });
  }

  /** 部品と、それらにつながる配線を削除する */
  function deleteComponents(ids: string[], record = true) {
    setCircuit((cur) => edit.removeComponents(cur, ids), record);
    setSelection(null);
  }

  function copySelection() {
    if (selection?.type !== 'comp') return;
    setClipboard(edit.extractComponents(circuit, selection.ids));
  }

  function cutSelection() {
    if (selection?.type !== 'comp') return;
    copySelection();
    deleteComponents(selection.ids);
  }

  /** コピーした部品の貼り付けを始める。位置はシートをクリックして決める */
  function startPaste() {
    if (!clipboard || clipboard.components.length === 0) return;
    // モジュールを、それ自身の中や、それを含む回路に貼ると循環してしまう
    const blocked = clipboard.components.find(
      (c) => c.kind === 'CUSTOM' && c.custom && (c.custom === circuit.id || dependsOn(project, c.custom, circuit.id)),
    );
    if (blocked) {
      const name = findDef(project, blocked.custom)?.name ?? '';
      setDialog({ message: `「${name}」はこの回路を含んでいるため、ここには貼り付けられません` });
      return;
    }
    setPending(null);
    setPlacing(clipboard);
  }

  /** 貼り付ける位置が決まった。delta はコピー元の位置からのずれ */
  function paste(delta: Point) {
    if (!placing) return;
    const clone = edit.cloneComponents(placing, newId, delta);
    setCircuit((cur) => edit.addParts(cur, clone));
    setSelection({ type: 'comp', ids: clone.components.map((c) => c.id) });
    setPlacing(null);
  }

  function deleteSelection() {
    if (!selection) return;
    if (selection.type === 'comp') {
      deleteComponents(selection.ids);
      return;
    }
    const id = selection.id;
    setCircuit((cur) => edit.removeWire(cur, id));
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
    const users = circuitsUsing(project, circuit.id);
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
        forget(id);
        setViews(({ [id]: _, ...rest }) => rest);
        openCircuit(MAIN_ID);
      },
    });
  }

  function setLabel(id: string, value: string) {
    setEditing(null);
    setCircuit((cur) => edit.setLabel(cur, id, value));
  }

  useShortcuts({
    enabled: !dialog && !promptDialog && !textDialog && !aboutOpen,
    onUndo: undoEdit,
    onRedo: redoEdit,
    onDelete: deleteSelection,
    onCopy: copySelection,
    onCut: cutSelection,
    onPaste: startPaste,
    onSelectAll: () => {
      setPending(null);
      const ids = circuit.components.map((c) => c.id);
      setSelection(ids.length > 0 ? { type: 'comp', ids } : null);
    },
    onEscape: () => {
      setPlacing(null);
      setPending(null);
      setSelection(null);
    },
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

  function moveComponents(positions: Map<string, Point>) {
    // ドラッグ中の移動は履歴に積まない。ドラッグの開始時に積んだ1回分で元に戻す
    setCircuit((cur) => edit.moveComponents(cur, positions), false);
  }

  function toggleInput(id: string) {
    // スイッチ操作は回路の編集ではないので、元に戻す対象にしない
    setCircuit((cur) => edit.toggleSwitch(cur, id), false);
  }

  function connect(from: PinRef, to: PinRef) {
    const id = newId();
    setCircuit((cur) => edit.connect(cur, id, from, to));
  }

  function disconnect(to: PinRef) {
    setCircuit((cur) => edit.disconnect(cur, to));
  }

  /** プロジェクト全体を置き換える (新規作成、読み込み)。元に戻すで戻せる */
  function replaceProject(next: Project) {
    setProject(() => next);
    forget();
    // 回路の ID が同じでも中身は別物なので、表示は初めから
    setViews({});
    openCircuit(MAIN_ID);
    setEditing(null);
  }

  function newProject() {
    setDialog({
      message:
        '新しいプロジェクトを作成しますか？今のプロジェクト (メイン回路とすべてのモジュール) は消えます (元に戻すで戻せます)。',
      confirmLabel: '新規作成',
      danger: true,
      onConfirm: () => replaceProject(emptyProject()),
    });
  }

  function exportProject() {
    setTextDialog({
      title: '書き出し',
      message: 'プロジェクト全体の書き出しができます。書き出したデータは「読み込み」画面に貼り付けてください。',
      initial: serializeProject(project),
      readOnly: true,
      field: {
        label: '作者名 (省略可)',
        initial: project.author ?? '',
        onChange: (value) => {
          // 作者名は回路の編集ではないので、元に戻す対象にしない
          const next: Project = { ...project, author: value };
          history.replace(next);
          return serializeProject(next);
        },
      },
      confirmLabel: 'コピー',
      doneMessage: 'コピーしました',
      onSubmit: async (text) => {
        try {
          await navigator.clipboard.writeText(text);
          return undefined;
        } catch {
          // 安全でない接続 (http) などでは、クリップボードに書き込めない
          return 'コピーできませんでした。上の文字列を選択して、手動でコピーしてください';
        }
      },
    });
  }

  function importProject() {
    setTextDialog({
      title: '読み込み',
      message: '書き出したデータを貼り付けてください。今のプロジェクトは置き換わりますが、元に戻すこともできます。',
      initial: '',
      confirmLabel: '読み込む',
      onSubmit: (text) => {
        const result = parseProject(text.trim(), newId);
        if (!result.ok) return result.error;
        replaceProject(result.project);
        if (result.project.author) setDialog({ message: `「${result.project.author}」さんの回路を読み込みました。` });
        return undefined;
      },
    });
  }

  const hints = statusHints({
    dragMode,
    wiring: !!pending,
    placing: !!placing,
    editing: !!editing,
    wireSelected: selection?.type === 'wire',
    selectedComponent:
      selection?.type === 'comp' && selection.ids.length === 1
        ? circuit.components.find((c) => c.id === selection.ids[0])
        : undefined,
    multipleSelected: selection?.type === 'comp' && selection.ids.length > 1,
    unstable: sim.unstable,
    inModule: circuit.id !== MAIN_ID,
  });

  return (
    <div className="app">
      <Header onAbout={() => setAboutOpen(true)} />
      <TabBar
        circuits={project.circuits}
        currentId={circuit.id}
        renamingId={editing?.type === 'tab' ? editing.id : undefined}
        onOpen={openCircuit}
        onStartRename={(id) => setEditing({ type: 'tab', id })}
        onRename={renameCircuit}
        onCancelRename={() => setEditing(null)}
        onDeleteCurrent={deleteCircuit}
        // タブの並びは保存データの回路の順なので、元に戻す対象にする
        onReorder={(id, index) => setProject((p) => moveCircuit(p, id, index))}
      />
      <Toolbar
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={undoEdit}
        onRedo={redoEdit}
        onAddModule={createModule}
        onNew={newProject}
        onExport={exportProject}
        onImport={importProject}
        running={running}
        onToggleRunning={toggleRunning}
        onStep={stepOnce}
        onStepBack={stepBack}
        canStepBack={canStepBack}
      />
      <div className="workspace">
        <Palette
          modules={paletteModules}
          dragMode={dragMode}
          trashRef={trashRef}
          collapsed={collapsedGroups}
          onCollapsedChange={setCollapsedGroups}
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
          view={view}
          onViewChange={(v) => setViews((vs) => ({ ...vs, [circuit.id]: v }))}
          onAdd={addComponent}
          onMoveStart={history.checkpoint}
          onMove={moveComponents}
          // 移動してから削除エリアに来た場合は、移動と削除をまとめて1回の操作にする
          onDropOnTrash={(ids, moved) => deleteComponents(ids, !moved)}
          onToggle={toggleInput}
          onConnect={connect}
          onDisconnect={disconnect}
          onComponentDoubleClick={onCompDoubleClick}
          onLabelCommit={setLabel}
          onLabelCancel={() => setEditing(null)}
          placing={placing}
          onPlace={paste}
        />
      </div>
      <StatusBar hints={hints} unstable={sim.unstable} />
      {dialog && <Dialog request={dialog} onClose={() => setDialog(null)} />}
      {promptDialog && <PromptDialog request={promptDialog} onClose={() => setPromptDialog(null)} />}
      {textDialog && <TextDialog request={textDialog} onClose={() => setTextDialog(null)} />}
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
    </div>
  );
}
