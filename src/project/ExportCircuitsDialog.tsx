import { Box, Button, Checkbox, Dialog as ChakraDialog, Stack, Text } from '@chakra-ui/react';
import { useMemo, useRef, useState } from 'react';
import { MAIN_ID, type Project } from '../circuit/project';
import { useMessages } from '../i18n/useMessages';
import { DialogFrame } from '../ui/DialogFrame';
import { withDependencies } from './exchange';
import { treeRows } from './folders';

export interface ExportCircuitsRequest {
  /** 開いたときに印を付けておく回路の ID (行のメニューから開いたときの、その行の回路) */
  initialSelected: string[];
  /** 回路 ids を回路ファイルに保存する。保存したら true、保存の画面で取り消したら false。保存できなければ例外を投げる */
  onSave: (ids: string[]) => Promise<boolean>;
}

/**
 * 回路を書き出すダイアログ。木の形の一覧で、書き出す回路に印を付ける (フォルダに付けると、中の回路をまとめて選ぶ)。
 * メイン回路は並べない (書き出せない)。「依存する回路も含める」(既定で印あり) と、書き出すものの一覧を出し、
 * 「ファイルに保存」で保存の画面を出す。保存したら閉じ、取り消したら開いたままにする
 */
export function ExportCircuitsDialog({
  request,
  project,
  onClose,
}: {
  request: ExportCircuitsRequest;
  project: Project;
  onClose: () => void;
}) {
  const m = useMessages();
  const [selected, setSelected] = useState(() => new Set(request.initialSelected));
  const [includeDependencies, setIncludeDependencies] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const cancelRef = useRef<HTMLButtonElement>(null);
  // 折り畳まずに、すべての行を並べる。メイン回路は書き出せないので並べない
  const rows = useMemo(
    () => treeRows(project, new Set()).filter((r) => r.kind === 'folder' || r.def.id !== MAIN_ID),
    [project],
  );
  /** フォルダ path の中 (入れ子を含む) の、書き出せる回路の ID */
  const circuitsIn = (path: string) =>
    project.circuits
      .filter(
        (d) =>
          d.id !== MAIN_ID && ((d.path ?? '') === path || (d.path ?? '').startsWith(`${path}/`)),
      )
      .map((d) => d.id);
  const exported = includeDependencies
    ? withDependencies(project, selected)
    : project.circuits.filter((d) => selected.has(d.id)).map((d) => d.id);
  const toggle = (ids: string[], on: boolean) =>
    setSelected((cur) => {
      const next = new Set(cur);
      for (const id of ids) {
        if (on) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  const exportable = rows.some((r) => r.kind === 'circuit');

  return (
    <DialogFrame
      onClose={onClose}
      initialFocus={cancelRef}
      size="md"
      onSubmit={async (e) => {
        e.preventDefault();
        if (exported.length === 0 || saving) {
          return;
        }
        setSaving(true);
        setError(undefined);
        try {
          if (await request.onSave(exported)) {
            onClose();
          }
        } catch (err) {
          // 書き込みの許可がない、空き容量がないなど。利用者には理由を出さないので、調べられるようにコンソールに残す
          console.error('回路ファイルを保存できませんでした', err);
          setError(m.file.saveFailed);
        } finally {
          setSaving(false);
        }
      }}
    >
      <ChakraDialog.Header>
        <ChakraDialog.Title>{m.exchange.exportTitle}</ChakraDialog.Title>
      </ChakraDialog.Header>
      <ChakraDialog.Body>
        <Stack gap="3">
          <Text textStyle="sm" fontWeight="medium">
            {m.exchange.exportTarget}
          </Text>
          {exportable ? (
            <Box
              as="ul"
              role="tree"
              borderWidth="1px"
              rounded="l2"
              maxH="56"
              overflowY="auto"
              py="1"
            >
              {rows.map((r) => {
                const ids = r.kind === 'folder' ? circuitsIn(r.path) : [r.def.id];
                const count = ids.filter((id) => selected.has(id)).length;
                const checked =
                  count === 0 ? false : count === ids.length ? true : ('indeterminate' as const);
                const key = r.kind === 'folder' ? `folder:${r.path}` : `circuit:${r.def.id}`;
                return (
                  <Box
                    as="li"
                    key={key}
                    role="treeitem"
                    listStyleType="none"
                    ps={`${8 + r.depth * 14}px`}
                    pe="2"
                    py="0.5"
                  >
                    <Checkbox.Root
                      size="sm"
                      checked={checked}
                      // 中に回路のないフォルダは選べない
                      disabled={ids.length === 0}
                      onCheckedChange={(e) => toggle(ids, e.checked === true)}
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                      <Checkbox.Label fontWeight={r.kind === 'folder' ? 'medium' : 'normal'}>
                        {r.kind === 'folder' ? r.name : r.def.name}
                      </Checkbox.Label>
                    </Checkbox.Root>
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Text textStyle="sm" color="fg.muted">
              {m.exchange.noExportable}
            </Text>
          )}
          <Checkbox.Root
            size="sm"
            checked={includeDependencies}
            onCheckedChange={(e) => setIncludeDependencies(e.checked === true)}
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control />
            <Checkbox.Label>{m.exchange.includeDependencies}</Checkbox.Label>
          </Checkbox.Root>
          <Text textStyle="sm" fontWeight="medium">
            {m.exchange.exportList(exported.length)}
          </Text>
          <Box as="ul" borderWidth="1px" rounded="l2" maxH="32" overflowY="auto" py="1" minH="8">
            {exported.map((id) => {
              const def = project.circuits.find((d) => d.id === id);
              return (
                <Box as="li" key={id} listStyleType="none" px="3" py="0.5" textStyle="sm">
                  <Text as="span">{def?.name}</Text>
                  {/* フォルダに入っていれば、フォルダのパスも添える (同じ名前の回路を見分けるため) */}
                  {def?.path && (
                    <Text as="span" color="fg.muted" ms="2">
                      {def.path}
                    </Text>
                  )}
                  {!selected.has(id) && (
                    <Text as="span" color="fg.muted" ms="2">
                      ({m.exchange.dependency})
                    </Text>
                  )}
                </Box>
              );
            })}
          </Box>
          {error && (
            <Text textStyle="sm" color="fg.error">
              {error}
            </Text>
          )}
        </Stack>
      </ChakraDialog.Body>
      <ChakraDialog.Footer>
        <Button ref={cancelRef} variant="outline" onClick={onClose}>
          {m.common.cancel}
        </Button>
        <Button type="submit" disabled={exported.length === 0 || saving}>
          {m.exchange.save}
        </Button>
      </ChakraDialog.Footer>
    </DialogFrame>
  );
}
