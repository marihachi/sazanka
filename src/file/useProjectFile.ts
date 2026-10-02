import type { ConfirmRequest } from '../ui/ConfirmDialog';
import type { TextRequest } from '../ui/TextDialog';
import { newId } from '../circuit/circuit';
import { emptyProject, type Project } from '../circuit/project';
import { parseProject, serializeProject } from './share';

/** プロジェクト全体の新規作成・書き出し・読み込み (ヘッダーの操作) */
export function useProjectFile({
  project,
  replaceProject,
  setProjectWithoutHistory,
  showConfirm,
  showText,
}: {
  project: Project;
  /** プロジェクト全体を置き換える (元に戻すで戻せる)。開いている回路や表示も初めからにする */
  replaceProject: (next: Project) => void;
  /** 元に戻す対象にせずにプロジェクトを更新する */
  setProjectWithoutHistory: (next: Project) => void;
  showConfirm: (request: ConfirmRequest) => void;
  showText: (request: TextRequest) => void;
}) {
  function newProject() {
    showConfirm({
      message:
        '新しいプロジェクトを作成しますか？今のプロジェクト (メイン回路とすべてのモジュール) は消えます (元に戻すで戻せます)。',
      confirmLabel: '新規作成',
      danger: true,
      onConfirm: () => replaceProject(emptyProject()),
    });
  }

  function exportProject() {
    showText({
      title: '書き出し',
      message:
        'プロジェクト全体の書き出しができます。書き出したデータは「読み込み」画面に貼り付けてください。',
      initial: serializeProject(project),
      readOnly: true,
      field: {
        label: '作者名 (省略可)',
        initial: project.author ?? '',
        onChange: (value) => {
          // 作者名は回路の編集ではないので、元に戻す対象にしない
          const next: Project = { ...project, author: value };
          setProjectWithoutHistory(next);
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
    showText({
      title: '読み込み',
      message:
        '書き出したデータを貼り付けてください。今のプロジェクトは置き換わりますが、元に戻すこともできます。',
      initial: '',
      confirmLabel: '読み込む',
      onSubmit: (text) => {
        const result = parseProject(text.trim(), newId);
        if (!result.ok) {
          return result.error;
        }
        replaceProject(result.project);
        if (result.project.author) {
          showConfirm({
            message: `「${result.project.author}」さんの回路を読み込みました。`,
          });
        }
        return undefined;
      },
    });
  }

  return { newProject, exportProject, importProject };
}
