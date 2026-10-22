import { checkCircuitName, findDef, type Project } from '../circuit/project';
import { describeNameProblem } from '../circuits/useCircuits';
import { getCircuitName, type Messages } from '../i18n/messages';
import type { ConfirmRequest } from '../ui/ConfirmDialog';
import type { PromptRequest } from '../ui/PromptDialog';
import {
  addFolder,
  checkFolderName,
  folderName,
  isEmptyFolder,
  joinPath,
  moveCircuitTo,
  moveFolderTo,
  parentOf,
  removeFolder as removeEmptyFolder,
  renameFolder as renameFolderIn,
} from './folders';
import type { MoveToFolderRequest } from './MoveToFolderDialog';
import type { NewCircuitRequest } from './NewCircuitDialog';
import type { ReplaceCircuitRequest } from './ReplaceCircuitDialog';
import { replaceCircuit as replaceIn, replaceTargets, samePins } from './replace';

/**
 * プロジェクトパネルでのフォルダの操作 (作る・名前を変える・削除) と、回路やフォルダを移す操作、
 * フォルダを選んで回路を追加する操作。どれも元に戻せる 1 回の編集にする
 */
export function useFolders({
  m,
  project,
  setProject,
  defaultCircuitName,
  addCircuit,
  showConfirm,
  showPrompt,
  showNewCircuit,
  showMoveToFolder,
  showReplace,
  onFolderMoved,
  onRemoved,
}: {
  /** 文言の表。このフックは言語を渡す側 (App) で呼ぶので、Context ではなく引数で受け取る */
  m: Messages;
  project: Project;
  /** 元に戻せる編集としてプロジェクトを更新する */
  setProject: (update: (p: Project) => Project) => void;
  /** フォルダ folder に置く回路の既定の名前 (circuits/useCircuits.ts) */
  defaultCircuitName: (folder: string) => string;
  /** フォルダ folder に回路を作り、開く (circuits/useCircuits.ts) */
  addCircuit: (name: string, folder: string) => void;
  showConfirm: (request: ConfirmRequest) => void;
  showPrompt: (request: PromptRequest) => void;
  showNewCircuit: (request: NewCircuitRequest) => void;
  showMoveToFolder: (request: MoveToFolderRequest) => void;
  showReplace: (request: ReplaceCircuitRequest) => void;
  /** フォルダのパスが from から to に変わった (改名と移動)。折り畳みの記録を付け替えるのに使う */
  onFolderMoved: (from: string, to: string) => void;
  /** 差し替えたあと、元の回路をプロジェクトから削除した (タブを閉じ、覚えている結果と表示を捨てる) */
  onRemoved: (id: string) => void;
}) {
  /** フォルダの名前が使えない理由の文 */
  function describeFolderProblem(problem: ReturnType<typeof checkFolderName>): string | undefined {
    return problem === 'EMPTY'
      ? m.folders.nameRequired
      : problem === 'BAD'
        ? m.folders.nameBad
        : problem === 'TAKEN'
          ? m.folders.nameTaken
          : undefined;
  }

  /** フォルダ parent の中にフォルダ name を作る (フォルダを選ぶ一覧の中から)。作れなければ理由を返す */
  function createFolder(parent: string, name: string): { error: string } | { path: string } {
    const error = describeFolderProblem(checkFolderName(project, parent, name));
    if (error) {
      return { error };
    }
    setProject((p) => addFolder(p, parent, name));
    return { path: joinPath(parent, name) };
  }

  /** 回路を追加するダイアログを開く。開いたときに選んでいるフォルダは folder */
  function newCircuit(folder: string, onCreated?: () => void) {
    showNewCircuit({
      initialFolder: folder,
      defaultName: defaultCircuitName,
      validate: (name, at) =>
        describeNameProblem(checkCircuitName(project, name, m.common.mainCircuit, at), m),
      onCreateFolder: createFolder,
      onSubmit: (name, at) => {
        addCircuit(name, at);
        onCreated?.();
      },
    });
  }

  /** 名前を入れるダイアログを出し、フォルダ parent の中に空のフォルダを作る */
  function newFolder(parent: string) {
    showPrompt({
      title: m.folders.newTitle,
      label: m.folders.name,
      initial: '',
      confirmLabel: m.folders.add,
      validate: (name) => describeFolderProblem(checkFolderName(project, parent, name)),
      onSubmit: (name) => setProject((p) => addFolder(p, parent, name)),
    });
  }

  /** フォルダ path の名前を変える (パネルの行の中の入力欄から)。空なら変えない。使えない名前なら、変えずにそのことを知らせる */
  function renameFolder(path: string, value: string) {
    const name = value.trim();
    const problem = checkFolderName(project, parentOf(path), name, path);
    if (problem === 'EMPTY' || name === folderName(path)) {
      return;
    }
    if (problem) {
      showConfirm({ message: describeFolderProblem(problem) ?? '' });
      return;
    }
    setProject((p) => renameFolderIn(p, path, name));
    onFolderMoved(path, joinPath(parentOf(path), name));
  }

  /** フォルダ path を削除する。空でなければ断る (中のものを先に動かすか削除してもらう。開発者が決めた) */
  function removeFolder(path: string) {
    if (!isEmptyFolder(project, path)) {
      showConfirm({ message: m.folders.notEmpty(folderName(path)) });
      return;
    }
    setProject((p) => removeEmptyFolder(p, path));
  }

  /** 回路 id のフォルダを変えるダイアログを開く */
  function moveToFolder(id: string) {
    const def = findDef(project, id);
    if (!def) {
      return;
    }
    showMoveToFolder({
      name: getCircuitName(def, m),
      folder: def.path ?? '',
      onCreateFolder: createFolder,
      onSubmit: (folder) => setProject((p) => moveCircuitTo(p, id, folder)),
    });
  }

  /** 回路 id を、フォルダ folder の中の index 番目へ移す (パネルでのドラッグ) */
  function dropCircuit(id: string, folder: string, index?: number) {
    setProject((p) => moveCircuitTo(p, id, folder, index));
  }

  /** フォルダ path を、フォルダ parent の中の index 番目へ移す (パネルでのドラッグ)。同じ名前があれば知らせて移さない */
  function dropFolder(path: string, parent: string, index?: number) {
    const moved = moveFolderTo(project, path, parent, index);
    if (!moved) {
      // 自分の中へ落としたときは、黙って何もしない。同じ名前があるときだけ知らせる
      if (!(parent === path || parent.startsWith(`${path}/`))) {
        showConfirm({ message: m.folders.nameTaken });
      }
      return;
    }
    setProject((p) => moveFolderTo(p, path, parent, index) ?? p);
    const to = joinPath(parent, folderName(path));
    if (to !== path) {
      onFolderMoved(path, to);
    }
  }

  /**
   * 回路 id を置いている部品を、別の回路に差し替えるダイアログを開く。差し替えは 1 回の編集にする
   * (元の回路を削除するなら、それも同じ 1 回に入れる)
   */
  function replace(id: string) {
    const def = findDef(project, id);
    if (!def) {
      return;
    }
    showReplace({
      name: getCircuitName(def, m),
      targets: replaceTargets(project, id),
      pinsDiffer: (target) => !samePins(project, id, target),
      onSubmit: (target, removeSource) => {
        setProject((p) => replaceIn(p, id, target, removeSource));
        if (removeSource) {
          onRemoved(id);
        }
      },
    });
  }

  return {
    newCircuit,
    replace,
    newFolder,
    renameFolder,
    removeFolder,
    moveToFolder,
    dropCircuit,
    dropFolder,
  };
}
