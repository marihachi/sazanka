import { Button, Dialog as ChakraDialog } from '@chakra-ui/react';
import { useRef, useState } from 'react';
import type { Project } from '../circuit/project';
import { useMessages } from '../i18n/useMessages';
import { DialogFrame } from '../ui/DialogFrame';
import { FolderPicker } from './FolderPicker';

export interface MoveToFolderRequest {
  /** 移す回路の表示名 */
  name: string;
  /** 今のフォルダ */
  folder: string;
  /** フォルダ parent の中にフォルダ name を作る (FolderPicker の onCreate) */
  onCreateFolder: (parent: string, name: string) => { error: string } | { path: string };
  onSubmit: (folder: string) => void;
}

/** 回路を置くフォルダを変えるダイアログ (行のメニューの「フォルダを変える…」)。今のフォルダのままなら「移す」は押せない */
export function MoveToFolderDialog({
  request,
  project,
  onClose,
}: {
  request: MoveToFolderRequest;
  project: Project;
  onClose: () => void;
}) {
  const m = useMessages();
  const [folder, setFolder] = useState(request.folder);
  // 開いたときは「キャンセル」にフォーカスする (一覧の行はフォーカスを受ける要素が選んでいる行だけなので)
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <DialogFrame
      onClose={onClose}
      initialFocus={cancelRef}
      onSubmit={(e) => {
        e.preventDefault();
        if (folder === request.folder) {
          return;
        }
        onClose();
        request.onSubmit(folder);
      }}
    >
      <ChakraDialog.Header>
        <ChakraDialog.Title>{m.folders.moveTitle(request.name)}</ChakraDialog.Title>
      </ChakraDialog.Header>
      <ChakraDialog.Body>
        <FolderPicker
          project={project}
          value={folder}
          onChange={setFolder}
          onCreate={request.onCreateFolder}
        />
      </ChakraDialog.Body>
      <ChakraDialog.Footer>
        <Button ref={cancelRef} variant="outline" onClick={onClose}>
          {m.common.cancel}
        </Button>
        <Button type="submit" disabled={folder === request.folder}>
          {m.folders.move}
        </Button>
      </ChakraDialog.Footer>
    </DialogFrame>
  );
}
