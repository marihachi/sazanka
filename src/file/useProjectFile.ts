import { useRef } from 'react';
import type { ConfirmRequest } from '../ui/ConfirmDialog';
import { newId } from '../circuit/circuit';
import { emptyProject, type Project } from '../circuit/project';
import { parseProject, serializeProject } from './projectFile';
import { getExportFileName, pickFile, readTextFile, saveJsonFile } from './localFile';
import { describeProjectFileError, type Messages } from '../i18n/messages';

/**
 * プロジェクト全体の新規作成・書き出し・読み込み (プロジェクトパネルの「⋯」の操作)。
 * 書き出しと読み込みは、アプリのダイアログを出さず、ブラウザの保存の画面とファイルを選ぶ画面だけを使う
 */
export function useProjectFile({
  project,
  openProject,
  showConfirm,
  m,
}: {
  /** 文言の表。このフックは言語を渡す側 (App) で呼ぶので、Context ではなく引数で受け取る */
  m: Messages;
  project: Project;
  /** 別のプロジェクトを開く。元に戻す・やり直しの履歴を消す (履歴はプロジェクトごとのもの)。開いている回路や表示も初めからにする */
  openProject: (next: Project) => void;
  showConfirm: (request: ConfirmRequest) => void;
}) {
  /**
   * 書き出しの途中 (保存の画面を開いてから書き終えるまで) か。途中で押されても、もう一度は保存しない
   * (保存の画面は、開いている間にもう一度開こうとすると例外になる)。
   * 読み込みには使わない。取り消したことを知らせない (cancel イベントのない) ブラウザでは、取り消すと終わりが分からず、
   * 読み込めないままになるため。ファイルを選ぶ画面は開いている間ほかの操作を受け付けないので、重ねて開くことはない
   */
  const exporting = useRef(false);

  function newProject() {
    showConfirm({
      message: m.file.confirmNew,
      confirmLabel: m.file.newProject,
      danger: true,
      // 新規作成は元に戻せない。履歴はプロジェクトごとのもので、別のプロジェクトを開けば前の履歴はなくなるため (開発者が決めた)
      onConfirm: () => openProject(emptyProject()),
    });
  }

  /** プロジェクトファイルとして保存する。保存の画面で取り消したら何もしない */
  async function exportProject() {
    if (exporting.current) {
      return;
    }
    exporting.current = true;
    try {
      await saveJsonFile(getExportFileName(new Date()), serializeProject(project));
    } catch (e) {
      // 書き込みの許可がない、空き容量がないなど。利用者には理由を出さないので、調べられるようにコンソールに残す
      console.error('プロジェクトファイルを保存できませんでした', e);
      showConfirm({ message: m.file.saveFailed });
    } finally {
      exporting.current = false;
    }
  }

  /** ファイルを選ぶ画面を開き、選んだプロジェクトファイルを開く。読めなければ理由を知らせる */
  async function importProject() {
    const file = await pickFile('.json,application/json');
    if (!file) {
      return;
    }
    let text: string;
    try {
      text = await readTextFile(file);
    } catch (e) {
      // 選んだあとにファイルが消された・動かされたときなど。調べられるようにコンソールに残す
      console.error('ファイルを読み取れませんでした', e);
      showConfirm({ message: m.file.readFailed });
      return;
    }
    const result = parseProject(text.trim(), newId);
    if (!result.ok) {
      showConfirm({ message: m.file.importFailed(describeProjectFileError(m, result.error)) });
      return;
    }
    openProject(result.project);
  }

  return { newProject, exportProject, importProject };
}
