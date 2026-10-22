import { Box, Flex, Text } from '@chakra-ui/react';
import { memo, useMemo, useState } from 'react';
import type { Project } from '../circuit/project';
import { getCircuitName } from '../i18n/messages';
import { useMessages } from '../i18n/useMessages';
import { CircuitTree, rowKey } from './CircuitTree';
import { type TreeRow, treeRows, usagesOf } from './folders';

interface ProjectPanelProps {
  project: Project;
  /** 折り畳んでいるフォルダのパス */
  collapsed: string[];
  onCollapsedChange: (collapsed: string[]) => void;
  /** 回路を開く (行のダブルクリックか Enter) */
  onOpen: (id: string) => void;
}

/**
 * 左のサイドパネルに出すプロジェクトパネル。プロジェクトの中の回路を、フォルダの木で並べる。
 * 行を押すと選び、下に、選んだ回路が使われている所を出す。ダブルクリックか Enter で開く
 */
export const ProjectPanel = memo(function ProjectPanel({
  project,
  collapsed,
  onCollapsedChange,
  onOpen,
}: ProjectPanelProps) {
  const m = useMessages();
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const collapsedSet = useMemo(() => new Set(collapsed), [collapsed]);
  const rows = useMemo(() => treeRows(project, collapsedSet), [project, collapsedSet]);
  const toggleFolder = (path: string) =>
    onCollapsedChange(
      collapsed.includes(path) ? collapsed.filter((p) => p !== path) : [...collapsed, path],
    );
  const selectedRow = rows.find((r) => rowKey(r) === selected);
  const usages = selectedRow?.kind === 'circuit' ? usagesOf(project, selectedRow.def.id) : [];

  return (
    <Flex direction="column" w="176px" flexShrink={0} bg="bg.panel" borderRightWidth="1px">
      <Flex h="9" px="3" align="center" borderBottomWidth="1px">
        <Text textStyle="sm" fontWeight="medium">
          {m.project.title}
        </Text>
      </Flex>
      <Box as="aside" flex="1" minH="0" overflowY="auto">
        <CircuitTree
          rows={rows}
          selected={selected}
          collapsed={collapsedSet}
          onSelect={(row: TreeRow) => setSelected(rowKey(row))}
          onActivate={(row: TreeRow) =>
            row.kind === 'folder' ? toggleFolder(row.path) : onOpen(row.def.id)
          }
          onToggleFolder={toggleFolder}
        />
      </Box>
      {selectedRow?.kind === 'circuit' && (
        <Box px="3" py="2" borderTopWidth="1px" textStyle="xs">
          <Text fontWeight="medium" truncate>
            {getCircuitName(selectedRow.def, m)}
          </Text>
          <Text color="fg.muted">{m.project.usedIn}:</Text>
          <Text>
            {usages.length === 0
              ? m.project.notUsed
              : usages
                  .map((u) => m.project.usage(getCircuitName(u.def, m), u.count))
                  .join(m.project.usageSeparator)}
          </Text>
        </Box>
      )}
    </Flex>
  );
}, samePanel);

/**
 * 描き直すかの判定。プロジェクトは部品を動かすたびに新しくなるが、パネルに出すのは
 * フォルダ、回路の ID と名前とパス、どの回路をどこに置いているかだけなので、それで比べる (パネルを描き直すとドラッグが重くなるため)
 */
function samePanel(a: ProjectPanelProps, b: ProjectPanelProps): boolean {
  return (
    a.collapsed === b.collapsed &&
    a.onCollapsedChange === b.onCollapsedChange &&
    a.onOpen === b.onOpen &&
    projectKey(a.project) === projectKey(b.project)
  );
}

function projectKey(project: Project): string {
  return [
    (project.folders ?? []).join('/'),
    ...project.circuits.map(
      (d) =>
        `${d.id}:${d.name}:${d.path ?? ''}:${d.parts
          .filter((c) => c.kind === 'module')
          .map((c) => c.circuitId)
          .join(',')}`,
    ),
  ].join('|');
}
