import { memo, useRef } from 'react';
import { Button, Flex, Heading, Menu, Portal, VisuallyHidden } from '@chakra-ui/react';
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
  onNewProject: () => void;
  onOpenProject: () => void;
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
}

/**
 * 最上部のヘッダー。ロゴと、プロジェクト全体に効く操作 (「ファイル」のメニュー (新規作成、開く、名前を付けて保存)、「回路」のメニュー (回路のインポートとエクスポート)、元に戻す、やり直し)、
 * 環境設定、このアプリについて。
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
}: HeaderProps) {
  const m = useMessages();
  return (
    <Flex as="header" align="center" gap="1.5" h="12" px="3" flexShrink={0} borderBottomWidth="1px">
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
          // ファイルを選ぶ画面と保存の画面は、押した操作の中でしか開けないので、閉じ終わるのを待たずにすぐ開く
          now={{ open: onOpenProject, saveAs: onSaveProjectAs }}
          // 確認のダイアログを出す新規作成は、閉じ終わってから行う
          later={{ new: onNewProject }}
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
      <Flex gap="1" ms="auto" flexShrink={0}>
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
 * ヘッダーのメニュー (「ファイル」「回路」)。文字と下向きの矢印のボタンで開く。
 * now の操作は選んだらすぐ行い、later の操作はメニューが閉じ終わってから行う (onExitComplete)。
 * 閉じている途中にダイアログを開くと、メニューがフォーカスを戻すときに、ダイアログが外を触られたとみなして閉じてしまうため
 */
function HeaderMenu({
  label,
  now = {},
  later = {},
  children,
}: {
  label: string;
  now?: Record<string, () => void>;
  later?: Record<string, () => void>;
  children: React.ReactNode;
}) {
  const pending = useRef<(() => void) | null>(null);
  return (
    <Menu.Root
      // メニューはボタンのすぐ下に出す (既定の 8px あけると離れて見えると開発者が言った)
      positioning={{ gutter: 2 }}
      onSelect={(e) => {
        now[e.value]?.();
        pending.current = later[e.value] ?? null;
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
