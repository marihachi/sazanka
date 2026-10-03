import { memo } from 'react';
import { Box, Flex } from '@chakra-ui/react';
import selectIcon from '../assets/icons/select.svg';
import wireIcon from '../assets/icons/wire.svg';
import pauseIcon from '../assets/icons/pause.svg';
import playIcon from '../assets/icons/play.svg';
import stepBackIcon from '../assets/icons/step-back.svg';
import stepIcon from '../assets/icons/step.svg';
import trashIcon from '../assets/icons/trash.svg';
import { ToolButton, ToolDivider } from '../ui/ToolButton';

/** シートの操作のモード。配線モードでは、クリックで配線を引く */
export type Tool = 'select' | 'wire';

interface SheetToolbarProps {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  /** シミュレーションが動いているか */
  running: boolean;
  onToggleRunning: () => void;
  /** 一時停止中に 1 tick だけ進める */
  onStep: () => void;
  /** 一時停止中に 1 tick だけ戻す */
  onStepBack: () => void;
  canStepBack: boolean;
  /** 開いている回路がモジュールなら、それを削除する。メイン回路では出さない */
  onDeleteModule?: () => void;
}

/**
 * タブの下のツールバー。開いている回路 (シート) に効く操作を置く。
 * プロジェクト全体に効く操作はヘッダーに置く
 */
export const SheetToolbar = memo(function SheetToolbar({
  tool,
  onToolChange,
  running,
  onToggleRunning,
  onStep,
  onStepBack,
  canStepBack,
  onDeleteModule,
}: SheetToolbarProps) {
  return (
    // 選択中のタブと同じ色にして、タブの中の操作だと見せる (TabBar.tsx)
    <Flex align="center" gap="0.5" px="2" py="1" bg="bg.panel" borderBottomWidth="1px">
      <ToolButton
        icon={selectIcon}
        label="選択"
        title="選択モード (W で切り替え): 部品や配線を選んで動かす"
        onClick={() => onToolChange('select')}
        active={tool === 'select'}
      />
      <ToolButton
        icon={wireIcon}
        label="配線"
        title="配線モード (W で切り替え): クリックした点から点へ配線を引く"
        onClick={() => onToolChange('wire')}
        active={tool === 'wire'}
      />
      <ToolDivider />
      <ToolButton
        icon={running ? pauseIcon : playIcon}
        label={running ? '一時停止' : '再開'}
        title={running ? 'シミュレーションを一時停止' : 'シミュレーションを再開'}
        onClick={onToggleRunning}
      />
      <ToolButton
        icon={stepBackIcon}
        label="1 tick 戻す"
        title="1 tick だけ時間を戻す"
        onClick={onStepBack}
        disabled={running || !canStepBack}
      />
      <ToolButton
        icon={stepIcon}
        label="1 tick 進める"
        title="1 tick だけ時間を進める"
        onClick={onStep}
        disabled={running}
      />
      {onDeleteModule && (
        <Box ms="auto">
          <ToolButton icon={trashIcon} label="モジュールを削除" onClick={onDeleteModule} danger />
        </Box>
      )}
    </Flex>
  );
});
