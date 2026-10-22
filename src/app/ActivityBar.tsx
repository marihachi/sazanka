import { Flex } from '@chakra-ui/react';
import { memo } from 'react';
import partsIcon from '../assets/icons/parts.svg';
import projectIcon from '../assets/icons/project.svg';
import type { SidePanel } from '../file/storage';
import { useMessages } from '../i18n/useMessages';
import { ToolButton } from '../ui/ToolButton';

/**
 * 左端の、アイコンだけの細い列。左のサイドパネルに出すもの (プロジェクトパネルとパレット) を切り替える。
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
  return (
    <Flex
      direction="column"
      align="center"
      gap="1"
      py="1"
      px="0.5"
      flexShrink={0}
      bg="bg.subtle"
      borderRightWidth="1px"
    >
      <ToolButton
        icon={projectIcon}
        label={m.sidePanel.project}
        onClick={() => onChange('project')}
        active={panel === 'project'}
        iconOnly
      />
      <ToolButton
        icon={partsIcon}
        label={m.sidePanel.parts}
        onClick={() => onChange('parts')}
        active={panel === 'parts'}
        iconOnly
      />
    </Flex>
  );
});
