import { useMemo } from 'react';
import type { ConfirmRequest } from '../ui/ConfirmDialog';
import type { PromptRequest } from '../ui/PromptDialog';
import type { PaletteModule } from '../palette/Palette';
import { newId } from '../circuit/circuit';
import { circuitsUsing, dependsOn } from '../circuit/module';
import { type CircuitDef, MAIN_ID, type Project } from '../circuit/project';

/** モジュールの追加・改名・削除と、パレットに並べるモジュールの一覧 */
export function useModules({
  project,
  circuit,
  setProject,
  openCircuit,
  onDeleted,
  showConfirm,
  showPrompt,
}: {
  project: Project;
  /** 開いている回路 */
  circuit: CircuitDef;
  /** 元に戻せる編集としてプロジェクトを更新する */
  setProject: (update: (p: Project) => Project) => void;
  openCircuit: (id: string) => void;
  /** モジュールを削除した。その回路について覚えているもの (シミュレーションの結果、表示) を捨てる */
  onDeleted: (id: string) => void;
  showConfirm: (request: ConfirmRequest) => void;
  showPrompt: (request: PromptRequest) => void;
}) {
  /**
   * パネルに並べるモジュール。今の回路に置けないもの (循環するもの) は理由付き。
   * 部品を動かしただけでは変わらないので、回路の名前と、どの回路にどのモジュールを置いているかが変わったときだけ作り直す
   * (作り直すとパレットが描き直され、ドラッグが重くなるため)
   */
  const modulesKey = [
    circuit.id,
    ...project.circuits.map(
      (d) =>
        `${d.id}:${d.name}:${d.parts
          .filter((c) => c.kind === 'module')
          .map((c) => c.module)
          .join(',')}`,
    ),
  ].join('|');
  // biome-ignore lint/correctness/useExhaustiveDependencies: 上の理由で、modulesKey が変わったときだけ作り直す
  const paletteModules: PaletteModule[] = useMemo(
    () =>
      project.circuits
        .filter((d) => d.id !== MAIN_ID)
        .map((d) => ({
          def: d,
          blocked:
            d.id === circuit.id
              ? 'モジュールの中に自分自身は置けません'
              : dependsOn(project, d.id, circuit.id)
                ? `「${d.name}」はこの回路を含んでいるため置けません`
                : undefined,
        })),
    [modulesKey],
  );

  /** 名前を入力するウィンドウを開き、確定したらモジュールを作成して開く */
  function createModule() {
    const names = new Set(project.circuits.map((d) => d.name));
    // 既定の名前の番号は、モジュールの数 + 1 から (回路の数にはメイン回路も入っている)。使われていれば次の番号にする
    let n = project.circuits.length;
    while (names.has(`モジュール${n}`)) {
      n++;
    }
    showPrompt({
      title: 'モジュールを追加',
      label: '名前',
      initial: `モジュール${n}`,
      confirmLabel: '追加',
      validate: (name) =>
        !name
          ? '名前を入力してください'
          : names.has(name)
            ? '同じ名前の回路がすでにあります'
            : undefined,
      onSubmit: (name) => {
        const def: CircuitDef = {
          id: newId(),
          name,
          footprint: { kind: 'dip', pins: 8 },
          parts: [],
          wires: [],
        };
        setProject((p) => ({ circuits: [...p.circuits, def] }));
        openCircuit(def.id);
      },
    });
  }

  /** 名前を変える。空の名前なら変えない */
  function renameCircuit(id: string, value: string) {
    const name = value.trim();
    if (!name) {
      return;
    }
    setProject((p) => ({
      circuits: p.circuits.map((d) => (d.id === id ? { ...d, name } : d)),
    }));
  }

  /** 開いているモジュールを削除する。ほかの回路で使われていれば断る */
  function deleteCircuit() {
    const users = circuitsUsing(project, circuit.id);
    if (users.length > 0) {
      showConfirm({
        message: `「${circuit.name}」は次の回路で使われているため削除できません: ${users.map((d) => d.name).join(', ')}`,
      });
      return;
    }
    const id = circuit.id;
    showConfirm({
      message: `モジュール「${circuit.name}」を削除しますか？`,
      confirmLabel: '削除',
      danger: true,
      onConfirm: () => {
        setProject((p) => ({
          circuits: p.circuits.filter((d) => d.id !== id),
        }));
        onDeleted(id);
        openCircuit(MAIN_ID);
      },
    });
  }

  return { paletteModules, createModule, renameCircuit, deleteCircuit };
}
