import { Flex, IconButton } from '@chakra-ui/react';
import { memo } from 'react';
import partsIcon from '../assets/icons/parts.svg';
import projectIcon from '../assets/icons/project.svg';
import type { SidePanel } from '../file/storage';
import { useMessages } from '../i18n/useMessages';
import { HintTooltip } from '../ui/HintTooltip';
import { MaskIcon } from '../ui/Icons';

/**
 * 左端の、アイコンだけの細い列 (アクティビティバー)。左のサイドパネルに出すもの (プロジェクトパネルとパレット) を切り替える。
 * 並びは上から「プロジェクト」「部品」
 */
export const ActivityBar = memo(function ActivityBar({
  panel,
  onChange,
}: {
  panel: SidePanel;
  onChange: (panel: SidePanel) => void;
}) {
  const m = useMessages();
  const items: { value: SidePanel; icon: string; label: string }[] = [
    { value: 'project', icon: projectIcon, label: m.sidePanel.project },
    { value: 'parts', icon: partsIcon, label: m.sidePanel.parts },
  ];
  return (
    <Flex
      direction="column"
      align="center"
      gap="1"
      py="1"
      px="1"
      flexShrink={0}
      bg="bg.subtle"
      borderRightWidth="1px"
    >
      {items.map((item) => (
        <HintTooltip key={item.value} content={item.label}>
          {/* アイコンは、ほかのツールボタン (16px) の 1.5 倍の 24px にする (開発者が決めた) */}
          <IconButton
            size="md"
            variant={panel === item.value ? 'subtle' : 'ghost'}
            colorPalette="gray"
            aria-label={item.label}
            aria-pressed={panel === item.value}
            onClick={() => onChange(item.value)}
          >
            <MaskIcon src={item.icon} boxSize="6" />
          </IconButton>
        </HintTooltip>
      ))}
    </Flex>
  );
});
