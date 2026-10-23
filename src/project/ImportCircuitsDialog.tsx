import {
  Box,
  Button,
  Dialog as ChakraDialog,
  Flex,
  IconButton,
  NativeSelect,
  Popover,
  Portal,
  Stack,
  Table,
  Text,
} from '@chakra-ui/react';
import { useRef, useState } from 'react';
import warningIcon from '../assets/icons/warning.svg';
import type { CircuitDef, Project } from '../circuit/project';
import { useMessages } from '../i18n/useMessages';
import { DialogFrame } from '../ui/DialogFrame';
import { MaskIcon } from '../ui/Icons';
import type { ImportAction, ImportRow } from './exchange';
import { FolderPicker } from './FolderPicker';

/** 選んだファイルを読んだ結果。読めた回路か、読めなかった理由の文 */
export type PickedCircuits = { name: string; circuits: CircuitDef[] } | { error: string };

export interface ImportCircuitsRequest {
  /** 開いたときに選んでいる読み込み先のフォルダ (パネルで選んでいるフォルダ。空ならフォルダなし) */
  initialFolder: string;
  /** フォルダ parent の中にフォルダ name を作る (FolderPicker の onCreate) */
  onCreateFolder: (parent: string, name: string) => { error: string } | { path: string };
  /** ファイルを選ぶ画面を開き、選んだ回路ファイルを読む。取り消したら undefined */
  pickFile: () => Promise<PickedCircuits | undefined>;
  /**
   * 読み込む回路の一覧 (project/exchange.ts の planImport)。ダイアログの中でフォルダを作るとプロジェクトが変わるので、
   * 今のプロジェクトを渡す
   */
  plan: (
    project: Project,
    circuits: CircuitDef[],
    folder: string,
    actions: ReadonlyMap<string, ImportAction>,
  ) => ImportRow[];
  /** 読み込む (まとめて 1 回の編集) */
  onSubmit: (
    circuits: CircuitDef[],
    folder: string,
    actions: ReadonlyMap<string, ImportAction>,
  ) => void;
}

/**
 * 回路を読み込むダイアログ。「ファイルを選ぶ」で回路ファイルを選び、読み込み先のフォルダ (その場で作れる) と、
 * 回路ごとの扱い (追加・置き換える・スキップ) を選んで「読み込む」。
 * 知らせ (ピンが変わる、スキップすると見つからなくなる、循環する) は、扱いの横の ⚠ で出す。
 * 読めないファイルなら、ダイアログの中に理由を出す (閉じない)
 */
export function ImportCircuitsDialog({
  request,
  project,
  onClose,
}: {
  request: ImportCircuitsRequest;
  project: Project;
  onClose: () => void;
}) {
  const m = useMessages();
  const [file, setFile] = useState<{ name: string; circuits: CircuitDef[] } | undefined>(undefined);
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const [folder, setFolder] = useState(request.initialFolder);
  const [actions, setActions] = useState<ReadonlyMap<string, ImportAction>>(new Map());
  const pickRef = useRef<HTMLButtonElement>(null);
  const rows = file ? request.plan(project, file.circuits, folder, actions) : [];
  const importable =
    rows.length > 0 && rows.some((r) => r.action !== 'skip') && rows.every((r) => !r.cycle);

  async function pick() {
    const picked = await request.pickFile();
    if (!picked) {
      return;
    }
    if ('error' in picked) {
      setFile(undefined);
      setFileError(picked.error);
      return;
    }
    setFile(picked);
    setFileError(undefined);
    // 扱いは、選び直したファイルの既定から始める
    setActions(new Map());
  }

  const labelOf = (row: ImportRow, action: ImportAction) =>
    action === 'add' && row.nameTaken ? m.exchange.actions.addRenamed : m.exchange.actions[action];
  const warningsOf = (row: ImportRow) => [
    ...(row.pinsChange ? [m.exchange.pinsChange] : []),
    ...(row.missingUsers.length > 0
      ? [m.exchange.willBeMissing(row.missingUsers.join(m.exchange.usersSeparator))]
      : []),
    ...(row.cycle ? [m.exchange.cycle] : []),
  ];

  return (
    <DialogFrame
      onClose={onClose}
      initialFocus={pickRef}
      size="lg"
      onSubmit={(e) => {
        e.preventDefault();
        if (!file || !importable) {
          return;
        }
        onClose();
        request.onSubmit(file.circuits, folder, actions);
      }}
    >
      <ChakraDialog.Header>
        <ChakraDialog.Title>{m.exchange.importTitle}</ChakraDialog.Title>
      </ChakraDialog.Header>
      <ChakraDialog.Body>
        <Stack gap="4">
          <Stack gap="1">
            <Flex align="center" gap="3" wrap="wrap">
              <Text textStyle="sm" fontWeight="medium">
                {m.exchange.file}
              </Text>
              <Text textStyle="sm" color={file ? undefined : 'fg.muted'} flex="1" minW="0" truncate>
                {file ? m.exchange.fileSummary(file.name, file.circuits.length) : m.exchange.noFile}
              </Text>
              <Button ref={pickRef} size="xs" variant="outline" colorPalette="gray" onClick={pick}>
                {m.exchange.pickFile}
              </Button>
            </Flex>
            {fileError && (
              <Text textStyle="sm" color="fg.error">
                {fileError}
              </Text>
            )}
          </Stack>
          <FolderPicker
            project={project}
            value={folder}
            onChange={setFolder}
            onCreate={request.onCreateFolder}
            label={m.exchange.targetFolder}
          />
          <Stack gap="1">
            <Text textStyle="sm" fontWeight="medium">
              {m.exchange.circuits}
            </Text>
            {file && file.circuits.length === 0 ? (
              <Text textStyle="sm" color="fg.muted">
                {m.exchange.empty}
              </Text>
            ) : (
              <Box borderWidth="1px" rounded="l2" maxH="64" overflowY="auto">
                <Table.Root size="sm" stickyHeader>
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>{m.exchange.fileName}</Table.ColumnHeader>
                      <Table.ColumnHeader>{m.exchange.projectName}</Table.ColumnHeader>
                      <Table.ColumnHeader>{m.exchange.action}</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {rows.map((row) => {
                      const warnings = warningsOf(row);
                      return (
                        <Table.Row key={row.def.id}>
                          <Table.Cell>{row.def.name}</Table.Cell>
                          {/* 読み込まないものは、プロジェクトに入らないので横線 */}
                          <Table.Cell
                            color={row.projectName === undefined ? 'fg.muted' : undefined}
                          >
                            {row.projectName ?? '—'}
                          </Table.Cell>
                          <Table.Cell>
                            <Flex align="center" gap="1">
                              <NativeSelect.Root size="xs" width="auto">
                                <NativeSelect.Field
                                  aria-label={`${row.def.name}: ${m.exchange.action}`}
                                  value={row.action}
                                  onChange={(e) => {
                                    const action = e.target.value as ImportAction;
                                    setActions((cur) => new Map(cur).set(row.def.id, action));
                                  }}
                                >
                                  {row.choices.map((a) => (
                                    <option key={a} value={a}>
                                      {labelOf(row, a)}
                                    </option>
                                  ))}
                                </NativeSelect.Field>
                                <NativeSelect.Indicator />
                              </NativeSelect.Root>
                              {warnings.length > 0 && <WarningTip lines={warnings} />}
                            </Flex>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Root>
              </Box>
            )}
          </Stack>
        </Stack>
      </ChakraDialog.Body>
      <ChakraDialog.Footer>
        <Button variant="outline" onClick={onClose}>
          {m.common.cancel}
        </Button>
        <Button type="submit" disabled={!importable}>
          {m.exchange.apply}
        </Button>
      </ChakraDialog.Footer>
    </DialogFrame>
  );
}

/**
 * 行の知らせの ⚠。ポインターを載せるか、押す (タップ) と、横に小さな吹き出しで内容を出す (開発者が決めた)。
 * タッチではポインターを載せられないので、押しても出す (ツールチップだけに頼らない)
 */
function WarningTip({ lines }: { lines: string[] }) {
  const m = useMessages();
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root
      open={open}
      onOpenChange={(e) => setOpen(e.open)}
      positioning={{ placement: 'right' }}
      size="xs"
    >
      <Popover.Trigger asChild>
        <IconButton
          size="2xs"
          variant="ghost"
          colorPalette="gray"
          color="fg.warning"
          aria-label={m.exchange.warning}
          onPointerEnter={(e) => e.pointerType === 'mouse' && setOpen(true)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setOpen(false)}
        >
          <MaskIcon src={warningIcon} boxSize="4" />
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content maxW="64">
            <Popover.Body>
              <Stack gap="1" textStyle="xs">
                {lines.map((line) => (
                  <Text key={line}>{line}</Text>
                ))}
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
