import { Button, Dialog as ChakraDialog, Field, Input, Stack } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import type { Project } from '../circuit/project';
import { useMessages } from '../i18n/useMessages';
import { DialogFrame } from '../ui/DialogFrame';
import { FolderPicker } from './FolderPicker';

export interface NewCircuitRequest {
  /** 開いたときに選んでいるフォルダ (パネルで選んでいるフォルダ。空ならフォルダなし) */
  initialFolder: string;
  /** フォルダ folder に置くときの既定の名前 */
  defaultName: (folder: string) => string;
  /** フォルダ folder に置く名前 name に問題があれば、理由の文を返す */
  validate: (name: string, folder: string) => string | undefined;
  /** フォルダ parent の中にフォルダ name を作る (FolderPicker の onCreate) */
  onCreateFolder: (parent: string, name: string) => { error: string } | { path: string };
  onSubmit: (name: string, folder: string) => void;
}

/**
 * 回路を追加するダイアログ。名前と、置くフォルダを選ぶ (フォルダはその場で作れる)。
 * 作ったフォルダは、追加しなくても残る (作った時点で 1 回の編集にする。開発者が決めた)
 */
export function NewCircuitDialog({
  request,
  project,
  onClose,
}: {
  request: NewCircuitRequest;
  project: Project;
  onClose: () => void;
}) {
  const m = useMessages();
  const [folder, setFolder] = useState(request.initialFolder);
  const [name, setName] = useState(() => request.defaultName(request.initialFolder));
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const error = request.validate(name.trim(), folder);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  return (
    <DialogFrame
      onClose={onClose}
      initialFocus={inputRef}
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (error) {
          return;
        }
        onClose();
        request.onSubmit(name.trim(), folder);
      }}
    >
      <ChakraDialog.Header>
        <ChakraDialog.Title>{m.circuits.addTitle}</ChakraDialog.Title>
      </ChakraDialog.Header>
      <ChakraDialog.Body>
        <Stack gap="4">
          <Field.Root invalid={touched && !!error}>
            <Field.Label>{m.circuits.name}</Field.Label>
            <Input
              ref={inputRef}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setTouched(true);
              }}
            />
            <Field.ErrorText>{error}</Field.ErrorText>
          </Field.Root>
          <FolderPicker
            project={project}
            value={folder}
            onChange={setFolder}
            onCreate={request.onCreateFolder}
          />
        </Stack>
      </ChakraDialog.Body>
      <ChakraDialog.Footer>
        <Button variant="outline" onClick={onClose}>
          {m.common.cancel}
        </Button>
        <Button type="submit" disabled={touched && !!error}>
          {m.circuits.add}
        </Button>
      </ChakraDialog.Footer>
    </DialogFrame>
  );
}
