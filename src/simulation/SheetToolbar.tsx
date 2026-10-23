import { memo } from 'react';
import { Flex } from '@chakra-ui/react';
import selectIcon from '../assets/icons/select.svg';
import wireIcon from '../assets/icons/wire.svg';
import splitIcon from '../assets/icons/split.svg';
import rotateIcon from '../assets/icons/rotate.svg';
import pauseIcon from '../assets/icons/pause.svg';
import playIcon from '../assets/icons/play.svg';
import stepBackIcon from '../assets/icons/step-back.svg';
import stepIcon from '../assets/icons/step.svg';
import packageIcon from '../assets/icons/package.svg';
import { ToolButton, ToolDivider } from '../ui/ToolButton';
import { useMessages } from '../i18n/useMessages';

/** シートの操作のモード。配線モードでは、クリックで配線を引く。分割モードでは、クリックした点で配線を 2 本に分ける */
export type Tool = 'select' | 'wire' | 'split';

interface SheetToolbarProps {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  /** 選んでいる部品と配線 (貼り付け中は貼り付けるもの) を時計回りに回す。キーの R と同じ */
  onRotate: () => void;
  /** 回せるものがあるか (選択モードで何か選んでいるか、貼り付け中) */
  canRotate: boolean;
  /** シミュレーションが動いているか */
  running: boolean;
  onToggleRunning: () => void;
  /** 一時停止中に 1 tick だけ進める */
  onStep: () => void;
  /** 一時停止中に 1 tick だけ戻す */
  onStepBack: () => void;
  canStepBack: boolean;
  /** 開いている回路の回路設定 (作者名、シートの大きさ、パッケージ、ポートの名前、ピンの割り当て) を開く。メイン回路でも出す */
  onCircuitSettings: () => void;
}

/**
 * タブの下のツールバー。開いている回路 (シート) に効く操作を置く。
 * プロジェクト全体に効く操作はヘッダーに置く
 */
export const SheetToolbar = memo(function SheetToolbar({
  tool,
  onToolChange,
  onRotate,
  canRotate,
  running,
  onToggleRunning,
  onStep,
  onStepBack,
  canStepBack,
  onCircuitSettings,
}: SheetToolbarProps) {
  const m = useMessages();
  return (
    // 選択中のタブと同じ色にして、タブの中の操作だと見せる (TabBar.tsx)
    <Flex align="center" gap="0.5" px="2" py="1" bg="bg.panel" borderBottomWidth="1px">
      <ToolButton
        icon={selectIcon}
        label={m.toolbar.select}
        title={m.toolbar.selectTitle}
        onClick={() => onToolChange('select')}
        active={tool === 'select'}
      />
      <ToolButton
        icon={wireIcon}
        label={m.toolbar.wire}
        title={m.toolbar.wireTitle}
        onClick={() => onToolChange('wire')}
        active={tool === 'wire'}
      />
      <ToolButton
        icon={splitIcon}
        label={m.toolbar.split}
        title={m.toolbar.splitTitle}
        onClick={() => onToolChange('split')}
        active={tool === 'split'}
      />
      <ToolDivider />
      <ToolButton
        icon={rotateIcon}
        label={m.toolbar.rotate}
        title={m.toolbar.rotateTitle}
        onClick={onRotate}
        disabled={!canRotate}
      />
      <ToolDivider />
      <ToolButton
        icon={running ? pauseIcon : playIcon}
        label={running ? m.toolbar.pause : m.toolbar.resume}
        title={running ? m.toolbar.pauseTitle : m.toolbar.resumeTitle}
        onClick={onToggleRunning}
      />
      <ToolButton
        icon={stepBackIcon}
        label={m.toolbar.stepBack}
        title={m.toolbar.stepBackTitle}
        onClick={onStepBack}
        disabled={running || !canStepBack}
      />
      <ToolButton
        icon={stepIcon}
        label={m.toolbar.stepForward}
        title={m.toolbar.stepForwardTitle}
        onClick={onStep}
        disabled={running}
      />
      <Flex ms="auto" gap="0.5">
        <ToolButton
          icon={packageIcon}
          label={m.toolbar.circuitSettings}
          title={m.toolbar.circuitSettingsTitle}
          onClick={onCircuitSettings}
        />
      </Flex>
    </Flex>
  );
});
