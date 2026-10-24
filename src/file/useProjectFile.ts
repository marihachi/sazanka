import { useEffect, useRef, useState } from 'react';
import type { ConfirmRequest } from '../ui/ConfirmDialog';
import { newId } from '../circuit/circuit';
import { emptyProject, type Project } from '../circuit/project';
import { parseProject, projectHash, serializeProject } from './projectFile';
import { getExportFileName, pickFile, readTextFile, saveJsonFile } from './localFile';
import { type FileState, loadFileState, saveFileState } from './storage';
import { describeProjectFileError, type Messages } from '../i18n/messages';
import { hashString } from '../util';

/**
 * 今のプロジェクトの指紋を、編集が落ち着いてから作るまでの待ち時間 (ms)。
 * ドラッグなどで続けて変わるあいだは作らない (毎回プロジェクトを文字列にすると重いため)
 */
const HASH_DELAY_MS = 300;

/**
 * プロジェクト全体の新規作成・書き出し・読み込み (ヘッダーの操作) と、今開いているファイルの名前、
 * ファイルに保存していない変更があるか。
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
  /**
   * 開いているファイルの名前と、開いた・保存したときのプロジェクトの指紋。localStorage に覚え、開き直したあとも使う。
   * 覚えていなければ (初めて開いたとき、この機能より前の保存データ)、ファイルなしで、今のプロジェクトを保存したときとみなす
   */
  const [file, setFile] = useState<FileState>(
    () => loadFileState() ?? { name: null, savedHash: projectHash(project) },
  );
  /** 今のプロジェクトの指紋。編集が落ち着いてから作る (HASH_DELAY_MS) */
  const [currentHash, setCurrentHash] = useState(() => projectHash(project));

  useEffect(() => {
    const timer = setTimeout(() => setCurrentHash(projectHash(project)), HASH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [project]);
  useEffect(() => saveFileState(file), [file]);

  /** ファイルの状態を、名前 name のファイルを開いた・保存したところ (そのときの指紋 hash) にする */
  function settle(name: string | null, hash: string) {
    setFile({ name, savedHash: hash });
    setCurrentHash(hash);
  }

  /** ファイルに保存していない変更があるか。押した時点のプロジェクトで確かめる (dirty は少し遅れて変わるため) */
  function hasUnsavedChanges(): boolean {
    return projectHash(project) !== file.savedHash;
  }

  /**
   * 別のプロジェクトに入れ替える前の確認 (開く前と新規作成の前)。ファイルに保存していない変更があるときだけ、
   * 「保存してから続ける」「保存しない」「キャンセル」を聞き、続けるなら next を呼ぶ。変更がなければ、聞かずに next を呼ぶ。
   * 確認を出すなら、確認を出す関数を返す (呼ぶ側が、メニューが閉じ終わってから呼ぶため)。出さないなら、next を呼んで undefined を返す。
   * next には、「保存してから続ける」で保存したかを渡す。
   * 「保存してから続ける」で保存の画面を取り消したら、続けない。ダウンロードで保存するブラウザでは、取り消したか分からないので続ける
   */
  function beforeLeaving(next: (saved: boolean) => void): (() => void) | undefined {
    if (!hasUnsavedChanges()) {
      next(false);
      return undefined;
    }
    return () =>
      showConfirm({
        message: m.file.confirmLeave,
        confirmLabel: m.file.saveFirst,
        onConfirm: async () => {
          if (await exportProject()) {
            next(true);
          }
        },
        secondaryLabel: m.file.discard,
        onSecondary: () => next(false),
      });
  }

  /**
   * 新規作成。ファイルに保存していない変更があれば、先に確認する (beforeLeaving)。
   * 新規作成は元に戻せない。履歴はプロジェクトごとのもので、別のプロジェクトを開けば前の履歴はなくなるため (開発者が決めた)
   */
  function newProject(): (() => void) | undefined {
    return beforeLeaving(() => {
      const next = emptyProject();
      openProject(next);
      settle(null, projectHash(next));
    });
  }

  /**
   * プロジェクトファイルとして保存する。保存の画面で取り消したら何もしない。
   * 既定の名前は、開いている (保存した) ファイルがあればその名前、なければ日付の名前
   */
  async function exportProject(): Promise<boolean> {
    if (exporting.current) {
      return false;
    }
    exporting.current = true;
    try {
      const text = serializeProject(project);
      const name = await saveJsonFile(file.name ?? getExportFileName(new Date()), text);
      if (name === undefined) {
        return false;
      }
      settle(name, hashString(text));
      return true;
    } catch (e) {
      // 書き込みの許可がない、空き容量がないなど。利用者には理由を出さないので、調べられるようにコンソールに残す
      console.error('プロジェクトファイルを保存できませんでした', e);
      showConfirm({ message: m.file.saveFailed });
      return false;
    } finally {
      exporting.current = false;
    }
  }

  /**
   * 開く。ファイルに保存していない変更があれば、先に確認する (beforeLeaving)。今のプロジェクトの処理 (確認と保存) と、
   * 開くプロジェクトの処理 (ファイルを選んで読み込む) は別のもので、ファイルを選ぶ画面で取り消しても、保存したことは取り消さない。
   * 「保存しない」を選んでからファイルを選ぶ画面で取り消したら、今のプロジェクトをそのまま残す (入れ替えるまで何も消さない)
   */
  function importProject(): (() => void) | undefined {
    return beforeLeaving(pickAfterLeaving);
  }

  /**
   * 確認のあとで、ファイルを選ぶ画面を開く。保存したあと (saved) は、もう一度押してもらう確認を出してから開く (開発者が決めた)。
   * ブラウザは利用者の操作の直後にしかファイルを選ぶ画面を開かせず、保存の画面 (showSaveFilePicker) はその効力を使い切るので、続けて開けない。
   * ダウンロードで保存するブラウザ (Firefox、Safari など) では効力が残るが、すぐ開くとダウンロードとファイルを選ぶ画面が同時に出るので、
   * 同じく確認を挟む (計画 27)
   */
  function pickAfterLeaving(saved: boolean) {
    if (saved) {
      showConfirm({
        message: m.file.pickAfterSave,
        confirmLabel: m.file.pickFile,
        onConfirm: () => void pickAndOpen(),
      });
      return;
    }
    void pickAndOpen();
  }

  /** ファイルを選ぶ画面を開き、選んだプロジェクトファイルを開く。読めなければ理由を知らせる */
  async function pickAndOpen() {
    const picked = await pickFile('.json,application/json');
    if (!picked) {
      return;
    }
    let text: string;
    try {
      text = await readTextFile(picked);
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
    // 開いたファイルの中身ではなく、読み込んだプロジェクトの指紋にする (古い版のファイルは、今の形に変えてから比べるため)
    settle(picked.name, projectHash(result.project));
  }

  return {
    newProject,
    exportProject,
    importProject,
    /** 開いているファイルの名前。なければ null */
    fileName: file.name,
    /** ファイルに保存していない変更があるか */
    dirty: currentHash !== file.savedHash,
  };
}
