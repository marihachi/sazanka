import type { ConfirmRequest } from '../ui/ConfirmDialog';
import type { TextRequest } from '../ui/TextDialog';
import { newId } from '../circuit/circuit';
import { emptyProject, type Project } from '../circuit/project';
import { parseProject, serializeProject } from './share';
import { describeShareError } from '../i18n/messages';
import { useMessages } from '../i18n/useMessages';

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
  const m = useMessages();
  function newProject() {
    showConfirm({
      message: m.file.confirmNew,
      confirmLabel: m.file.newProject,
      danger: true,
      onConfirm: () => replaceProject(emptyProject()),
    });
  }

  function exportProject() {
    showText({
      title: m.file.exportTitle,
      message: m.file.exportMessage,
      initial: serializeProject(project),
      readOnly: true,
      field: {
        label: m.file.author,
        initial: project.author ?? '',
        onChange: (value) => {
          // 作者名は回路の編集ではないので、元に戻す対象にしない
          const next: Project = { ...project, author: value };
          setProjectWithoutHistory(next);
          return serializeProject(next);
        },
      },
      confirmLabel: m.file.copy,
      doneMessage: m.file.copied,
      onSubmit: async (text) => {
        try {
          await navigator.clipboard.writeText(text);
          return undefined;
        } catch {
          // 安全でない接続 (http) などでは、クリップボードに書き込めない
          return m.file.copyFailed;
        }
      },
    });
  }

  function importProject() {
    showText({
      title: m.file.importTitle,
      message: m.file.importMessage,
      initial: '',
      confirmLabel: m.file.importConfirm,
      onSubmit: (text) => {
        const result = parseProject(text.trim(), newId);
        if (!result.ok) {
          return describeShareError(m, result.error);
        }
        replaceProject(result.project);
        if (result.project.author) {
          showConfirm({
            message: m.file.importedFrom(result.project.author),
          });
        }
        return undefined;
      },
    });
  }

  return { newProject, exportProject, importProject };
}
