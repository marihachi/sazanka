import { Box, Flex, Menu, Portal, Text } from '@chakra-ui/react';
import { memo, useMemo, useRef, useState } from 'react';
import collapseAllIcon from '../assets/icons/collapse-all.svg';
import expandAllIcon from '../assets/icons/expand-all.svg';
import newCircuitIcon from '../assets/icons/new-circuit.svg';
import newFolderIcon from '../assets/icons/new-folder.svg';
import { MAIN_ID, type Project } from '../circuit/project';
import { getCircuitName } from '../i18n/messages';
import { useMessages } from '../i18n/useMessages';
import { SidePanelHeader } from '../ui/SidePanelHeader';
import { ToolButton } from '../ui/ToolButton';
import { CircuitTree, type MenuPoint, rowKey } from './CircuitTree';
import { dropTarget, type TreeRow, treeRows, usagesOf } from './folders';

interface ProjectPanelProps {
  project: Project;
  /** 折り畳んでいるフォルダのパス */
  collapsed: string[];
  onCollapsedChange: (collapsed: string[]) => void;
  /** 名前を変えている行 (CircuitTree の rowKey) */
  renaming?: string;
  /** 回路を開く (行のダブルクリック、Enter、行のメニューの「開く」) */
  onOpen: (id: string) => void;
  onStartRenameCircuit: (id: string) => void;
  onStartRenameFolder: (path: string) => void;
  onRenameCircuit: (id: string, name: string) => void;
  onRenameFolder: (path: string, name: string) => void;
  onCancelRename: () => void;
  /** プロジェクトから削除する (確認は呼ぶ側が出す) */
  onRemove: (id: string) => void;
  onRemoveFolder: (path: string) => void;
  /** 回路を置いている部品を、別の回路に差し替える (ダイアログは呼ぶ側が出す) */
  onReplace: (id: string) => void;
  /** 回路 id に印を付けて、回路を書き出すダイアログを開く */
  onExport: (id: string) => void;
  /** フォルダ path の中の回路に印を付けて、回路を書き出すダイアログを開く */
  onExportFolder: (path: string) => void;
  /** フォルダ folder に回路を追加する (ダイアログで、folder を選んだ状態で始める) */
  onNewCircuit: (folder: string) => void;
  /** フォルダ parent の中にフォルダを作る */
  onNewFolder: (parent: string) => void;
  onDropCircuit: (id: string, folder: string, index?: number) => void;
  onDropFolder: (path: string, parent: string, index?: number) => void;
}

/**
 * 行のメニュー。どの行で、画面のどこに出すか。open は開いているか。
 * 閉じ始めても、閉じ終わるまで行を覚えておく (すぐ忘れると、閉じる間の表示で項目が変わってしまうため。
 * メイン回路の行で、出さない項目が一瞬出ていた)
 */
interface RowMenu {
  row: TreeRow;
  at: MenuPoint;
  open: boolean;
}

/**
 * 左のサイドパネルに出すプロジェクトパネル。プロジェクトの中の回路を、フォルダの木で並べる。
 * 行を押すと選び、下に、選んだ回路が使われている所を出す。ダブルクリックか Enter で開く。
 * 上から、パネルの名前、ツールバー (回路とフォルダの追加、すべて折り畳む)、回路の木の順に並べる。行のメニュー (右クリック、長押し、行の「⋯」) に行の操作をまとめる。
 * 行をドラッグすると、並べ替えたりフォルダへ移したりできる
 */
export const ProjectPanel = memo(function ProjectPanel(props: ProjectPanelProps) {
  const { project, collapsed, onCollapsedChange, renaming } = props;
  const m = useMessages();
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [rowMenu, setRowMenu] = useState<RowMenu | null>(null);
  /**
   * メニューで選んだ操作。メニューが閉じ終わってから行う (onExitComplete)。閉じている途中に確認のダイアログを開くと、
   * メニューがフォーカスを戻すときに、ダイアログが外を触られたとみなして閉じてしまうため
   */
  const pending = useRef<(() => void) | null>(null);
  const runPending = () => {
    const action = pending.current;
    pending.current = null;
    action?.();
  };
  const collapsedSet = useMemo(() => new Set(collapsed), [collapsed]);
  const rows = useMemo(() => treeRows(project, collapsedSet), [project, collapsedSet]);
  /** すべてのフォルダのパス (すべて折り畳む・すべて展開に使う) */
  const allFolders = useMemo(
    () => treeRows(project, new Set()).flatMap((r) => (r.kind === 'folder' ? [r.path] : [])),
    [project],
  );
  const allCollapsed = allFolders.length > 0 && allFolders.every((p) => collapsedSet.has(p));
  const toggleFolder = (path: string) =>
    onCollapsedChange(
      collapsed.includes(path) ? collapsed.filter((p) => p !== path) : [...collapsed, path],
    );
  const selectedRow = rows.find((r) => rowKey(r) === selected);
  const usages = selectedRow?.kind === 'circuit' ? usagesOf(project, selectedRow.def.id) : [];
  /** 追加するときに選んでおくフォルダ。フォルダの行を選んでいればそのフォルダ、回路の行ならその回路のフォルダ、なければフォルダなし */
  const selectedFolder =
    selectedRow?.kind === 'folder'
      ? selectedRow.path
      : selectedRow?.kind === 'circuit'
        ? (selectedRow.def.path ?? '')
        : '';
  const menuRow = rowMenu?.row;
  const menuIsMain = menuRow?.kind === 'circuit' && menuRow.def.id === MAIN_ID;

  return (
    <Flex direction="column" w="176px" flexShrink={0} bg="bg.panel" borderRightWidth="1px">
      <SidePanelHeader
        title={m.project.title}
        toolbarLabel={m.project.toolbar}
        toolbar={
          <>
            <ToolButton
              icon={newCircuitIcon}
              // 回路のアイコンは緑にする (開発者が求めた)
              iconColor="green.400"
              label={m.project.newCircuit}
              onClick={() => props.onNewCircuit(selectedFolder)}
              iconOnly
              iconSize="5"
              size="xs"
            />
            <ToolButton
              icon={newFolderIcon}
              // フォルダのアイコンはオレンジにする (開発者が求めた)
              iconColor="orange.400"
              label={m.project.newFolder}
              onClick={() => props.onNewFolder(selectedFolder)}
              iconOnly
              iconSize="5"
              size="xs"
            />
            {/* フォルダがなければ押せない */}
            <ToolButton
              icon={allCollapsed ? expandAllIcon : collapseAllIcon}
              label={allCollapsed ? m.palette.expandAll : m.palette.collapseAll}
              onClick={() => onCollapsedChange(allCollapsed ? [] : allFolders)}
              disabled={allFolders.length === 0}
              iconOnly
              iconSize="5"
              size="xs"
            />
          </>
        }
      />
      <Box as="aside" flex="1" minH="0" overflowY="auto">
        <CircuitTree
          rows={rows}
          selected={selected}
          collapsed={collapsedSet}
          renaming={renaming}
          hasMenu={() => true}
          onSelect={(row) => setSelected(rowKey(row))}
          onActivate={(row) =>
            row.kind === 'folder' ? toggleFolder(row.path) : props.onOpen(row.def.id)
          }
          onToggleFolder={toggleFolder}
          onMenu={(row, at) => setRowMenu({ row, at, open: true })}
          onStartRename={(row) => {
            if (row.kind === 'folder') {
              props.onStartRenameFolder(row.path);
            } else if (row.def.id !== MAIN_ID) {
              props.onStartRenameCircuit(row.def.id);
            }
          }}
          onRename={(row, name) =>
            row.kind === 'folder'
              ? props.onRenameFolder(row.path, name)
              : props.onRenameCircuit(row.def.id, name)
          }
          onCancelRename={props.onCancelRename}
          dropTargetOf={(dragged, over, zone) => dropTarget(project, rows, dragged, over, zone)}
          onDrop={(dragged, target) => {
            if (dragged.kind === 'circuit' && target.kind === 'circuit') {
              props.onDropCircuit(dragged.def.id, target.folder, target.index);
            } else if (dragged.kind === 'folder' && target.kind === 'folder') {
              props.onDropFolder(dragged.path, target.parent, target.index);
            }
          }}
        />
      </Box>
      {/* 行のメニュー。行ごとに持たず、押した行と位置を覚えて 1 つだけ出す */}
      <Menu.Root
        open={rowMenu?.open ?? false}
        onOpenChange={(e) => {
          if (!e.open) {
            setRowMenu((cur) => cur && { ...cur, open: false });
          }
        }}
        // 押した位置に出す。トリガーのないメニューでは anchorPoint が効かず、画面の左上に出てしまうので、
        // 位置の基準 (getAnchorRect) を、押した点の大きさのない四角にする
        positioning={{
          placement: 'bottom-start',
          getAnchorRect: () =>
            rowMenu ? { x: rowMenu.at.x, y: rowMenu.at.y, width: 0, height: 0 } : null,
        }}
        onSelect={(e) => {
          if (!menuRow) {
            return;
          }
          if (menuRow.kind === 'folder') {
            const path = menuRow.path;
            const actions: Record<string, () => void> = {
              newCircuit: () => props.onNewCircuit(path),
              newFolder: () => props.onNewFolder(path),
              rename: () => props.onStartRenameFolder(path),
              removeFolder: () => props.onRemoveFolder(path),
              export: () => props.onExportFolder(path),
            };
            pending.current = actions[e.value] ?? null;
            return;
          }
          const id = menuRow.def.id;
          const actions: Record<string, () => void> = {
            open: () => props.onOpen(id),
            rename: () => props.onStartRenameCircuit(id),
            replace: () => props.onReplace(id),
            export: () => props.onExport(id),
            remove: () => props.onRemove(id),
          };
          pending.current = actions[e.value] ?? null;
        }}
        onExitComplete={() => {
          setRowMenu(null);
          runPending();
        }}
      >
        <Portal>
          <Menu.Positioner>
            {menuRow?.kind === 'folder' ? (
              <Menu.Content>
                <Menu.Item value="newCircuit">{m.project.newCircuit}</Menu.Item>
                <Menu.Item value="newFolder">{m.project.newFolder}</Menu.Item>
                <Menu.Separator />
                <Menu.Item value="rename">{m.project.rename}</Menu.Item>
                <Menu.Item value="export">{m.exchange.exportRow}</Menu.Item>
                <Menu.Separator />
                <Menu.Item value="removeFolder" color="fg.error">
                  {m.project.removeFolder}
                </Menu.Item>
              </Menu.Content>
            ) : (
              <Menu.Content>
                <Menu.Item value="open">{m.project.open}</Menu.Item>
                {/* メイン回路は、名前を変えられず、プロジェクトから削除できない */}
                {!menuIsMain && <Menu.Item value="rename">{m.project.rename}</Menu.Item>}
                {/* メイン回路はほかの回路に置けないので、差し替えるものもない */}
                {!menuIsMain && <Menu.Item value="replace">{m.project.replace}</Menu.Item>}
                {/* メイン回路は書き出せない */}
                {!menuIsMain && <Menu.Item value="export">{m.exchange.exportRow}</Menu.Item>}
                {!menuIsMain && (
                  <>
                    <Menu.Separator />
                    <Menu.Item value="remove" color="fg.error">
                      {m.project.remove}
                    </Menu.Item>
                  </>
                )}
              </Menu.Content>
            )}
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
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
 * フォルダ、回路の ID と名前とパス、どの回路をどこに置いているかだけなので、それで比べる (パネルを描き直すとドラッグが重くなるため)。
 * そのほかの props は、そのまま比べる (App は同じ関数を渡し続ける)
 */
function samePanel(a: ProjectPanelProps, b: ProjectPanelProps): boolean {
  const { project: pa, ...ra } = a;
  const { project: pb, ...rb } = b;
  return (
    projectKey(pa) === projectKey(pb) &&
    (Object.keys(ra) as (keyof typeof ra)[]).every((k) => ra[k] === rb[k])
  );
}

function projectKey(project: Project): string {
  return [
    (project.folders ?? []).join('\n'),
    ...project.circuits.map(
      (d) =>
        `${d.id}:${d.name}:${d.path ?? ''}:${d.parts
          .filter((c) => c.kind === 'module')
          .map((c) => c.circuitId)
          .join(',')}`,
    ),
  ].join('|');
}
