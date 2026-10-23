import { Box, Button, Flex, Stack, Text } from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import type { Project } from '../circuit/project';
import { useMessages } from '../i18n/useMessages';
import { InlineInput } from '../ui/InlineInput';
import { treeRows } from './folders';

/**
 * フォルダを選ぶ木 (回路の追加のダイアログで使う。計画 22 の読み込みのダイアログでも使う)。
 * いちばん上に「(フォルダなし)」、その下にフォルダを木の形で並べる (回路は出さない)。
 * 「フォルダを作る」を押すと、選んでいるフォルダの中に入力欄を出し、確定するとフォルダを作って選ぶ
 * (ダイアログを重ねないため、入力欄は一覧の中に出す。開発者が決めた)
 */
export function FolderPicker({
  project,
  value,
  onChange,
  onCreate,
}: {
  project: Project;
  /** 選んでいるフォルダのパス。空ならフォルダなし */
  value: string;
  onChange: (path: string) => void;
  /**
   * フォルダ parent の中にフォルダ name を作る (その時点でプロジェクトに足す)。作れなければ理由の文を返す。
   * 作れたら、作ったフォルダのパスを返す
   */
  onCreate: (parent: string, name: string) => { error: string } | { path: string };
}) {
  const m = useMessages();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  // フォルダだけを木にする (回路は並べない)
  const rows = useMemo(
    () => treeRows({ ...project, circuits: [] }).filter((r) => r.kind === 'folder'),
    [project],
  );
  const depthOf = (path: string) => (path === '' ? 0 : path.split('/').length);
  const row = (path: string, name: string, depth: number) => (
    <Box
      as="li"
      key={path}
      role="treeitem"
      aria-selected={value === path}
      tabIndex={value === path ? 0 : -1}
      listStyleType="none"
      ps={`${8 + depth * 14}px`}
      pe="2"
      py="1"
      textStyle="sm"
      cursor="pointer"
      userSelect="none"
      bg={value === path ? 'bg.emphasized' : undefined}
      _hover={{ bg: value === path ? 'bg.emphasized' : 'bg.muted' }}
      onClick={() => onChange(path)}
      onKeyDown={(e) => {
        if (e.key === ' ') {
          e.preventDefault();
          onChange(path);
        }
      }}
    >
      <Text as="span" truncate>
        {name}
      </Text>
    </Box>
  );
  // 並べる行: いちばん上に「(フォルダなし)」、そのあとにフォルダ
  const items = [
    { path: '', name: m.folders.none, depth: 0 },
    ...rows.flatMap((r) =>
      r.kind === 'folder' ? [{ path: r.path, name: r.name, depth: r.depth + 1 }] : [],
    ),
  ];
  // 入力欄は、選んでいるフォルダの子孫の最後の行のあとに出す (フォルダなしを選んでいれば、いちばん最後)
  const insertAt = (() => {
    if (value === '') {
      return items.length;
    }
    let at = items.findIndex((it) => it.path === value);
    while (at + 1 < items.length && items[at + 1].path.startsWith(`${value}/`)) {
      at++;
    }
    return at + 1;
  })();
  const input = (
    <Box
      as="li"
      key="(new)"
      listStyleType="none"
      ps={`${8 + (depthOf(value) + 1) * 14}px`}
      pe="2"
      py="1"
    >
      <InlineInput
        initial=""
        placeholder={m.folders.name}
        onCommit={(name) => {
          const result = onCreate(value, name.trim());
          if ('error' in result) {
            setError(result.error);
            setCreating(false);
            return;
          }
          setCreating(false);
          setError(undefined);
          onChange(result.path);
        }}
        onCancel={() => {
          setCreating(false);
          setError(undefined);
        }}
      />
    </Box>
  );
  const list = items.map((it) => row(it.path, it.name, it.depth));
  if (creating) {
    list.splice(insertAt, 0, input);
  }

  return (
    <Stack gap="2">
      <Flex align="center" justify="space-between">
        <Text textStyle="sm" fontWeight="medium">
          {m.folders.folder}
        </Text>
        <Button
          size="xs"
          variant="outline"
          colorPalette="gray"
          disabled={creating}
          onClick={() => setCreating(true)}
        >
          {m.folders.create}
        </Button>
      </Flex>
      <Box as="ul" role="tree" borderWidth="1px" rounded="l2" maxH="48" overflowY="auto" py="1">
        {list}
      </Box>
      {error && (
        <Text textStyle="sm" color="fg.error">
          {error}
        </Text>
      )}
    </Stack>
  );
}
