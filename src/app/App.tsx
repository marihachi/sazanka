import { Flex } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { Sheet, type SheetSize, type DragMode } from '../sheet/Sheet';
import type { Selection } from '../editing/edit';
import { Header } from './Header';
import { Palette } from '../palette/Palette';
import { PropertyPanel } from './PropertyPanel';
import { StatusBar } from '../hints/StatusBar';
import { TabBar } from '../modules/TabBar';
import { SheetToolbar, type Tool } from '../simulation/SheetToolbar';
import { overview, toWorld } from '../geometry/view';
import * as edit from '../editing/edit';
import { clampPosition, GRID, type Point, snap } from '../geometry/layout';
import type { Component, ComponentKind } from '../circuit/component';
import { newId, type Wire } from '../circuit/circuit';
import { findDef, MAIN_ID, moveCircuit, type CircuitDef, type Project } from '../circuit/project';
import { portsOf } from '../circuit/module';
import { statusHints } from '../hints/hints';
import { computeNets, isConflict } from '../geometry/net';
import {
  loadCollapsedGroups,
  loadProject,
  loadPreferences,
  loadViews,
  saveCollapsedGroups,
  saveProject,
  savePreferences,
  saveViews,
} from '../file/storage';
import { useClipboard } from '../editing/useClipboard';
import { useDialogs } from './useDialogs';
import { useModules } from '../modules/useModules';
import { useProjectFile } from '../file/useProjectFile';
import { useSimulation } from '../simulation/useSimulation';
import { useProjectHistory } from '../editing/useProjectHistory';
import { useShortcuts } from '../editing/useShortcuts';
import { useStableCallbacks } from './useStableCallbacks';

/** その場で編集中の名前 (タブのモジュール名) */
type Editing = { type: 'tab'; id: string } | null;

/**
 * 画面全体の組み立てと、状態のつなぎ役。
 * まとまった操作は別のフックにある (ダイアログ: useDialogs、コピー・貼り付け: useClipboard、
 * 新規作成・書き出し・読み込み: useProjectFile、モジュールの管理: useModules)。ここには回路の編集と、画面の組み立てを置く
 */
export function App() {
  const [loaded] = useState(loadProject);
  const history = useProjectHistory(() => loaded.project);
  const project = history.project;
  /** 元に戻せる編集としてプロジェクトを更新する */
  const setProject = history.commit;
  const [currentId, setCurrentId] = useState(MAIN_ID);
  const [selection, setSelection] = useState<Selection>(null);
  const [tool, setTool] = useState<Tool>('select');
  /** 配線中に置いた点 (始点から順に)。配線中でなければ null */
  const [pending, setPending] = useState<Point[] | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>('none');
  /** クリックで部品を追加するとき、表示している範囲の真ん中に置くために使う */
  const [sheetSize, setSheetSize] = useState<SheetSize>({
    width: 0,
    height: 0,
  });
  /** 回路ごとの表示位置と倍率。元に戻す対象にはしない */
  const [views, setViews] = useState(loadViews);
  const [editing, setEditing] = useState<Editing>(null);
  const [preferences, setPreferences] = useState(loadPreferences);
  const [collapsedGroups, setCollapsedGroups] = useState(loadCollapsedGroups);
  const circuit = findDef(project, currentId) ?? project.circuits[0];
  // 表示を保存していない回路は、回路全体が見える表示で開く
  const view = views[circuit.id] ?? overview(circuit, project, sheetSize.width, sheetSize.height);

  const dialogs = useDialogs({
    initialMessage: loaded.error ? `${loaded.error}空のプロジェクトで開きます。` : undefined,
    preferences,
    onPreferencesChange: setPreferences,
  });

  /** 開いている回路を更新する。record を false にすると元に戻す対象にしない */
  function setCircuit(update: (c: CircuitDef) => CircuitDef, record = true) {
    const id = circuit.id;
    (record ? history.commit : history.replace)((p) => ({
      circuits: p.circuits.map((d) => (d.id === id ? update(d) : d)),
    }));
  }

  const { simStore, unstable, running, toggleRunning, stepOnce, stepBack, canStepBack, forget } =
    useSimulation(project, circuit.id, preferences.tickMs);
  useEffect(() => saveProject(project), [project]);
  useEffect(() => saveCollapsedGroups(collapsedGroups), [collapsedGroups]);
  useEffect(() => saveViews(views), [views]);
  useEffect(() => savePreferences(preferences), [preferences]);
  // アクセントカラーは、ページ全体の色の変数を差し替えて反映する
  useEffect(
    () => document.documentElement.style.setProperty('--accent', preferences.accent),
    [preferences.accent],
  );
  // 表示を保存していない回路は、開いた時点の表示をすぐに保存して固定する。
  // 固定しないと、部品を置くたびに「回路全体が見える表示」が計算し直され、画面が勝手に動いてしまう
  const viewSaved = circuit.id in views;
  const sheetReady = sheetSize.width > 0 && sheetSize.height > 0;
  useEffect(() => {
    if (!viewSaved && sheetReady) {
      setViews((vs) => ({ ...vs, [circuit.id]: view }));
    }
  }, [viewSaved, sheetReady, circuit.id, view]);

  /** 選んでいる部品と配線を削除する */
  function deleteSelection(record = true) {
    if (!selection) {
      return;
    }
    const { comps, wires } = selection;
    setCircuit((cur) => edit.removeParts(cur, comps, wires), record);
    setSelection(null);
  }

  const clipboard = useClipboard({
    project,
    circuit,
    selection,
    onSelect: setSelection,
    onPendingChange: setPending,
    setCircuit,
    deleteSelection,
    showConfirm: dialogs.showConfirm,
  });

  function openCircuit(id: string) {
    clipboard.cancelPaste();
    setCurrentId(id);
    setSelection(null);
    setPending(null);
  }

  const modules = useModules({
    project,
    circuit,
    setProject,
    openCircuit,
    onDeleted: (id) => {
      forget(id);
      setViews(({ [id]: _, ...rest }) => rest);
    },
    showConfirm: dialogs.showConfirm,
    showPrompt: dialogs.showPrompt,
  });

  const file = useProjectFile({
    project,
    replaceProject: (next: Project) => {
      setProject(() => next);
      forget();
      // 回路の ID が同じでも中身は別物なので、表示は初めから
      setViews({});
      openCircuit(MAIN_ID);
      setEditing(null);
    },
    setProjectWithoutHistory: history.replace,
    showConfirm: dialogs.showConfirm,
    showText: dialogs.showText,
  });

  /** 部品を追加する。位置を省略すると、表示している範囲の真ん中あたりに、重ならないよう少しずつずらして置く */
  function addComponent(kind: ComponentKind, custom?: string, at?: Point) {
    const n = circuit.components.length;
    const center = toWorld(view, {
      x: sheetSize.width / 2,
      y: sheetSize.height / 2,
    });
    // 置くたびに 1 マスずつ右下へずらす。10 個ごとに元の位置へ戻る
    const base = at ?? {
      x: center.x - GRID * 2 + (n % 10) * GRID,
      y: center.y - GRID * 2 + (n % 10) * GRID,
    };
    const c: Component = {
      id: newId(),
      kind,
      x: snap(base.x),
      y: snap(base.y),
    };
    // ON/OFF を持つ部品は OFF から始める。CLOCK の実際の ON/OFF はシミュレーションの中で持つ (useSimulation.ts)
    if (kind === 'INPUT' || kind === 'CLOCK') {
      c.on = false;
    }
    if (custom) {
      c.custom = custom;
    }
    Object.assign(c, clampPosition(c, portsOf(c, project), c));
    setCircuit((cur) => edit.addComponent(cur, c));
    setSelection({ comps: [c.id], wires: [] });
  }

  /** 選択モードと配線モードを切り替える。配線中の線は取り消す */
  function changeTool(next: Tool) {
    setPending(null);
    setTool(next);
  }

  useShortcuts({
    enabled: !dialogs.anyOpen,
    onUndo: undoEdit,
    onRedo: redoEdit,
    onDelete: () => deleteSelection(),
    onCopy: clipboard.copy,
    onCut: clipboard.cut,
    onPaste: clipboard.startPaste,
    onSelectAll: () => {
      setPending(null);
      setSelection(
        edit.selectionOf(
          circuit.components.map((c) => c.id),
          circuit.wires.map((w) => w.id),
        ),
      );
    },
    onEscape: () => {
      clipboard.cancelPaste();
      setPending(null);
      setSelection(null);
    },
    onToggleWireTool: () => changeTool(tool === 'wire' ? 'select' : 'wire'),
  });

  /** 選択や編集中の状態は、戻した先に存在しないことがあるので解除する */
  function resetInteraction() {
    setSelection(null);
    setPending(null);
    setEditing(null);
  }

  function undoEdit() {
    // ドラッグ中は、ドラッグの開始時点との整合が崩れるので受け付けない
    if (dragMode !== 'none') {
      return;
    }
    history.undo();
    resetInteraction();
  }

  function redoEdit() {
    if (dragMode !== 'none') {
      return;
    }
    history.redo();
    resetInteraction();
  }

  function onCompDoubleClick(c: Component) {
    if (c.kind === 'CUSTOM' && c.custom && findDef(project, c.custom)) {
      openCircuit(c.custom);
    }
  }

  function moveParts(comps: Map<string, Point>, wires: Map<string, Point[]>) {
    // ドラッグ中の移動は履歴に積まない。ドラッグの開始時に積んだ1回分で元に戻す
    setCircuit((cur) => edit.moveParts(cur, comps, wires), false);
  }

  function toggleInput(id: string) {
    // スイッチ操作は回路の編集ではないので、元に戻す対象にしない
    setCircuit((cur) => edit.toggleSwitch(cur, id), false);
  }

  function addWire(points: Point[]) {
    const wire: Wire = { id: newId(), points };
    setCircuit((cur) => edit.addWire(cur, wire));
  }

  /** 1つだけ選んでいる部品 (配線は選んでいない)。プロパティ欄とヒントに使う */
  const selectedComponent =
    selection?.comps.length === 1 && selection.wires.length === 0
      ? circuit.components.find((c) => c.id === selection.comps[0])
      : undefined;

  // 開いている回路の配線のつながり。描画 (Sheet) と、出力のぶつかりの警告に使う
  const nets = useMemo(() => computeNets(circuit, project), [circuit, project]);
  const conflict = nets.nets.some(isConflict);

  const hints = statusHints({
    dragMode,
    wireTool: tool === 'wire',
    wiring: !!pending,
    placing: !!clipboard.placing,
    editing: !!editing,
    wireSelected: selection?.comps.length === 0 && selection.wires.length === 1,
    selectedComponent,
    multipleSelected: !!selection && selection.comps.length + selection.wires.length > 1,
    unstable,
    conflict,
    inModule: circuit.id !== MAIN_ID,
    tickMs: preferences.tickMs,
  });

  // 子の部品へ渡す関数。ドラッグの一歩ごとに App は描き直されるが、ドラッグで中身の変わらない部品
  // (ヘッダー、タブバー、ツールバー、パレット、プロパティ欄) は描き直さないよう、同じ関数を渡し続ける
  const on = useStableCallbacks({
    newProject: file.newProject,
    exportProject: file.exportProject,
    importProject: file.importProject,
    undoEdit,
    redoEdit,
    openPreferences: dialogs.openPreferences,
    openAbout: dialogs.openAbout,
    openCircuit,
    startRename: (id: string) => setEditing({ type: 'tab', id }),
    renameCircuit: (id: string, value: string) => {
      setEditing(null);
      modules.renameCircuit(id, value);
    },
    cancelRename: () => setEditing(null),
    createModule: modules.createModule,
    // タブの並びは保存データの回路の順なので、元に戻す対象にする
    reorder: (id: string, index: number) => setProject((p) => moveCircuit(p, id, index)),
    toggleRunning,
    stepOnce,
    stepBack,
    deleteCircuit: modules.deleteCircuit,
    changeTool,
    addFromPalette: (kind: ComponentKind, custom?: string) => addComponent(kind, custom),
    // 入力中の変更は履歴に積まない。最初の変更の直前に積んだ1回分で元に戻す
    setClockPeriod: (id: string, period: number) =>
      setCircuit((cur) => edit.setClockPeriod(cur, id, period), false),
    setLabel: (id: string, label: string) =>
      setCircuit((cur) => edit.setLabel(cur, id, label), false),
  });

  return (
    <Flex direction="column" h="full">
      <Header
        onNew={on.newProject}
        onExport={on.exportProject}
        onImport={on.importProject}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={on.undoEdit}
        onRedo={on.redoEdit}
        onPreferences={on.openPreferences}
        onAbout={on.openAbout}
      />
      <TabBar
        circuits={project.circuits}
        currentId={circuit.id}
        renamingId={editing?.type === 'tab' ? editing.id : undefined}
        onOpen={on.openCircuit}
        onStartRename={on.startRename}
        onRename={on.renameCircuit}
        onCancelRename={on.cancelRename}
        onAddModule={on.createModule}
        onReorder={on.reorder}
      />
      <SheetToolbar
        tool={tool}
        onToolChange={on.changeTool}
        running={running}
        onToggleRunning={on.toggleRunning}
        onStep={on.stepOnce}
        onStepBack={on.stepBack}
        canStepBack={canStepBack}
        onDeleteModule={circuit.id !== MAIN_ID ? on.deleteCircuit : undefined}
      />
      <Flex flex="1" minH="0">
        <Palette
          modules={modules.paletteModules}
          collapsed={collapsedGroups}
          onCollapsedChange={setCollapsedGroups}
          onAdd={on.addFromPalette}
        />
        <Sheet
          project={project}
          circuit={circuit}
          nets={nets}
          tool={tool}
          simStore={simStore}
          selection={selection}
          onSelect={setSelection}
          pending={pending}
          onPendingChange={setPending}
          dragMode={dragMode}
          onDragModeChange={setDragMode}
          onResize={setSheetSize}
          view={view}
          showGrid={preferences.showGrid}
          roundWires={preferences.roundWires}
          onViewChange={(v) => setViews((vs) => ({ ...vs, [circuit.id]: v }))}
          onAdd={addComponent}
          onMoveStart={history.checkpoint}
          onMove={moveParts}
          // 移動してから削除エリアに来た場合は、移動と削除をまとめて1回の操作にする
          onDropOnTrash={(moved) => deleteSelection(!moved)}
          onToggle={toggleInput}
          onAddWire={addWire}
          onComponentDoubleClick={onCompDoubleClick}
          placing={clipboard.placing}
          onPlace={clipboard.paste}
        />
        <PropertyPanel
          component={selectedComponent}
          moduleName={
            selectedComponent?.kind === 'CUSTOM'
              ? findDef(project, selectedComponent.custom)?.name
              : undefined
          }
          tickMs={preferences.tickMs}
          onEditStart={history.checkpoint}
          onClockPeriodChange={on.setClockPeriod}
          onLabelChange={on.setLabel}
        />
      </Flex>
      <StatusBar hints={hints} unstable={unstable} conflict={conflict} />
      {dialogs.element}
    </Flex>
  );
}
