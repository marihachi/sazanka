import { memo } from 'react';
import { Flex, Heading, VisuallyHidden } from '@chakra-ui/react';
import exportIcon from '../assets/icons/export.svg';
import importIcon from '../assets/icons/import.svg';
import infoIcon from '../assets/icons/info.svg';
import preferencesIcon from '../assets/icons/preferences.svg';
import logoMark from '../assets/logo-mark.svg';
import newIcon from '../assets/icons/new.svg';
import redoIcon from '../assets/icons/redo.svg';
import undoIcon from '../assets/icons/undo.svg';
import { MaskIcon } from '../ui/Icons';
import { ToolButton, ToolDivider } from '../ui/ToolButton';
import { useMessages } from '../i18n/useMessages';

interface HeaderProps {
  onNew: () => void;
  onExport: () => void;
  onImport: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onPreferences: () => void;
  onAbout: () => void;
}

/**
 * 最上部のヘッダー。ロゴと、プロジェクト全体に効く操作 (新規作成、読み込み、書き出し、元に戻す、やり直し)。
 * 元に戻すの履歴はすべての回路で1本なので、全体の操作としてここに置く。開いている回路に効く操作はシートのツールバーにある
 */
export const Header = memo(function Header({
  onNew,
  onExport,
  onImport,
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
      {/* 入りきらない幅では横にスクロールする */}
      <Flex
        as="nav"
        align="center"
        gap="0.5"
        minW="0"
        overflowX="auto"
        aria-label={m.header.toolbar}
      >
        <ToolButton
          icon={newIcon}
          label={m.header.newProject}
          title={m.header.newProjectTitle}
          onClick={onNew}
        />
        <ToolButton
          icon={importIcon}
          label={m.header.importProject}
          title={m.header.importProjectTitle}
          onClick={onImport}
        />
        <ToolButton
          icon={exportIcon}
          label={m.header.exportProject}
          title={m.header.exportProjectTitle}
          onClick={onExport}
        />
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
