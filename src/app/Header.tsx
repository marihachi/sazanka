import { memo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Flex,
  Heading,
  Menu,
  Popover,
  Portal,
  Text,
  VisuallyHidden,
} from '@chakra-ui/react';
import chevronIcon from '../assets/icons/chevron.svg';
import exportIcon from '../assets/icons/export.svg';
import importIcon from '../assets/icons/import.svg';
import infoIcon from '../assets/icons/info.svg';
import preferencesIcon from '../assets/icons/preferences.svg';
import logoMark from '../assets/logo-mark.svg';
import newIcon from '../assets/icons/new.svg';
import redoIcon from '../assets/icons/redo.svg';
import undoIcon from '../assets/icons/undo.svg';
import { MaskIcon, ToolIcon } from '../ui/Icons';
import { ToolButton, ToolDivider } from '../ui/ToolButton';
import { useMessages } from '../i18n/useMessages';

interface HeaderProps {
  /**
   * 新規作成と開く。確認を出すときは、確認を出す関数を返す (メニューが閉じ終わってから呼ぶ)。
   * 確認を出さないときは、その場で行う (開くは、ファイルを選ぶ画面を押した操作の中で開くため)
   */
  onNewProject: () => (() => void) | undefined;
  onOpenProject: () => (() => void) | undefined;
  onSaveProjectAs: () => void;
  /** 回路を読み込むダイアログを開く */
  onImportCircuits: () => void;
  /** 回路を書き出すダイアログを開く */
  onExportCircuits: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onPreferences: () => void;
  onAbout: () => void;
  /** 開いているファイルの名前。なければ null (「(未保存)」と出す) */
  fileName: string | null;
  /** ファイルに保存していない変更があるか (名前の横に ● を付ける) */
  dirty: boolean;
}

/**
 * 最上部のヘッダー。ロゴと、プロジェクト全体に効く操作 (「ファイル」のメニュー (新規作成、開く、名前を付けて保存)、「回路」のメニュー (回路のインポートとエクスポート)、元に戻す、やり直し)、
 * 真ん中に、開いているファイルの名前と、保存していない変更の印 (●)。右端に環境設定、このアプリについて。
 * 元に戻すの履歴はすべての回路で1本なので、全体の操作としてここに置く。開いている回路に効く操作はシートのツールバーに、
 * 回路とフォルダの操作はプロジェクトパネルにある
 */
export const Header = memo(function Header({
  onNewProject,
  onOpenProject,
  onSaveProjectAs,
  onImportCircuits,
  onExportCircuits,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onPreferences,
  onAbout,
  fileName,
  dirty,
}: HeaderProps) {
  const m = useMessages();
  return (
    <Flex as="header" align="center" gap="1.5" h="12" px="3" flexShrink={0} borderBottomWidth="1px">
      <Flex align="center" gap="1.5" minW="0">
        <Heading as="h1" display="flex" flexShrink={0}>
          <MaskIcon src={logoMark} boxSize="7" bg="brand" />
          <VisuallyHidden>sazanka</VisuallyHidden>
        </Heading>
        {/*
        入りきらない幅では横にスクロールする。
        スクロールする箱はフォーカスの枠も切ってしまうので、内側に枠の分の余白をとる (右は外側の負の余白で位置を保つ)。
        左は、ロゴとの間を少しあける (ロゴの端からボタンの地の端まで 12px。近すぎると開発者が言った)
      */}
        <Flex
          as="nav"
          align="center"
          gap="0.5"
          minW="0"
          overflowX="auto"
          p="1"
          me="-1"
          ms="0.5"
          aria-label={m.header.toolbar}
        >
          <HeaderMenu
            label={m.header.file}
            // ファイルを選ぶ画面と保存の画面は、押した操作の中でしか開けないので、閉じ終わるのを待たずにすぐ開く。
            // 新規作成と開くは、保存していない変更の確認を出すなら、それだけ閉じ終わってから出す
            now={{ new: onNewProject, open: onOpenProject, saveAs: onSaveProjectAs }}
          >
            <Menu.Item value="new">
              <ToolIcon src={newIcon} />
              {m.header.newProject}
            </Menu.Item>
            <Menu.Item value="open">
              <ToolIcon src={importIcon} />
              {m.header.openProject}
            </Menu.Item>
            <Menu.Item value="saveAs">
              <ToolIcon src={exportIcon} />
              {m.header.saveProjectAs}
            </Menu.Item>
          </HeaderMenu>
          {/* 回路のインポートとエクスポートは、「ファイル」の隣の「回路」のメニューに置く (開発者が決めた)。どちらもダイアログを出す */}
          <HeaderMenu
            label={m.exchange.menu}
            later={{ importCircuits: onImportCircuits, exportCircuits: onExportCircuits }}
          >
            {/* アイコンは、「ファイル」の開く・名前を付けて保存と同じもの (取り込む・書き出すの向きが同じため) */}
            <Menu.Item value="importCircuits">
              <ToolIcon src={importIcon} />
              {m.exchange.importMenu}
            </Menu.Item>
            <Menu.Item value="exportCircuits">
              <ToolIcon src={exportIcon} />
              {m.exchange.exportMenu}
            </Menu.Item>
          </HeaderMenu>
          <ToolDivider />
          <ToolButton
            icon={undoIcon}
            label={m.header.undo}
            title={m.header.undoTitle}
            onClick={onUndo}
            disabled={!canUndo}
          />
          <ToolButton
            icon={redoIcon}
            label={m.header.redo}
            title={m.header.redoTitle}
            onClick={onRedo}
            disabled={!canRedo}
          />
        </Flex>
      </Flex>
      {/*
        ファイルの名前は、左右の操作のあいだの空いている所の真ん中に置く (開発者が決めた)。
        狭い画面で空きがなければ名前は省かれて見えなくなるが、● は残す (左右の操作と離すため、両側に少し余白をとる)
      */}
      <Flex flex="1" minW="0" justify="center" px="1">
        <FileName name={fileName ?? m.header.unsaved} unsaved={fileName === null} dirty={dirty} />
      </Flex>
      <Flex gap="1" flexShrink={0}>
        <ToolButton
          icon={preferencesIcon}
          label={m.header.preferences}
          onClick={onPreferences}
          iconOnly
        />
        <ToolButton icon={infoIcon} label={m.header.about} onClick={onAbout} iconOnly />
      </Flex>
    </Flex>
  );
});

/**
 * ヘッダーの真ん中の、開いているファイルの名前。長ければ末尾を省く。
 * 保存していない変更があれば、名前の横に ● を付ける。● にポインターを載せるか押すと、説明の吹き出しを出す
 * (タッチではポインターを載せられないので、押しても出す)
 */
function FileName({ name, unsaved, dirty }: { name: string; unsaved: boolean; dirty: boolean }) {
  const m = useMessages();
  const [open, setOpen] = useState(false);
  return (
    <Flex align="center" gap="1" minW="0" maxW="full">
      <Text textStyle="sm" color={unsaved ? 'fg.muted' : 'fg'} truncate title={name}>
        {name}
      </Text>
      {/* ● の場所はいつもとっておく。付いたり消えたりしても、名前が動かないようにする (開発者が求めた) */}
      {!dirty && <Box flexShrink={0} w="5" h="5" aria-hidden="true" />}
      {dirty && (
        <Popover.Root
          open={open}
          onOpenChange={(e) => setOpen(e.open)}
          positioning={{ placement: 'bottom' }}
          size="xs"
        >
          <Popover.Trigger asChild>
            <Box
              as="button"
              aria-label={m.header.dirty}
              flexShrink={0}
              w="5"
              h="5"
              display="flex"
              alignItems="center"
              justifyContent="center"
              rounded="full"
              cursor="pointer"
              color="fg.muted"
              _hover={{ color: 'fg' }}
              onPointerEnter={(e) => e.pointerType === 'mouse' && setOpen(true)}
              onPointerLeave={(e) => e.pointerType === 'mouse' && setOpen(false)}
            >
              <Box w="2" h="2" rounded="full" bg="currentColor" />
            </Box>
          </Popover.Trigger>
          <Portal>
            <Popover.Positioner>
              <Popover.Content maxW="64">
                <Popover.Body textStyle="xs">{m.header.dirtyDetail}</Popover.Body>
              </Popover.Content>
            </Popover.Positioner>
          </Portal>
        </Popover.Root>
      )}
    </Flex>
  );
}

/**
 * ヘッダーのメニュー (「ファイル」「回路」)。文字と下向きの矢印のボタンで開く。
 * now の操作は選んだらすぐ行い、later の操作はメニューが閉じ終わってから行う (onExitComplete)。
 * now の操作が関数を返したら、その関数はメニューが閉じ終わってから呼ぶ (確認のダイアログを出すときなど)。
 * 閉じている途中にダイアログを開くと、メニューがフォーカスを戻すときに、ダイアログが外を触られたとみなして閉じてしまうため
 */
function HeaderMenu({
  label,
  now = {},
  later = {},
  children,
}: {
  label: string;
  now?: Record<string, () => unknown>;
  later?: Record<string, () => void>;
  children: React.ReactNode;
}) {
  const pending = useRef<(() => void) | null>(null);
  return (
    <Menu.Root
      // メニューはボタンのすぐ下に出す (既定の 8px あけると離れて見えると開発者が言った)
      positioning={{ gutter: 2 }}
      onSelect={(e) => {
        const deferred = now[e.value]?.();
        pending.current =
          later[e.value] ?? (typeof deferred === 'function' ? (deferred as () => void) : null);
      }}
      onExitComplete={() => {
        const action = pending.current;
        pending.current = null;
        action?.();
      }}
    >
      <Menu.Trigger asChild>
        {/* 狭い画面でも、文字は隠さない (アイコンがないため) */}
        <Button variant="ghost" size="sm" colorPalette="gray" flexShrink={0} px="2.5">
          {label}
          <MaskIcon src={chevronIcon} boxSize="3" />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>{children}</Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
