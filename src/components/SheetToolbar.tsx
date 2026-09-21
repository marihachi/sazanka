import pauseIcon from '../assets/icons/pause.svg';
import playIcon from '../assets/icons/play.svg';
import stepBackIcon from '../assets/icons/step-back.svg';
import stepIcon from '../assets/icons/step.svg';
import trashIcon from '../assets/icons/trash.svg';
import styles from './SheetToolbar.module.css';
import { ToolButton } from './ToolButton';

interface SheetToolbarProps {
  /** シミュレーションが動いているか */
  running: boolean;
  onToggleRunning: () => void;
  /** 一時停止中に1段だけ進める */
  onStep: () => void;
  /** 一時停止中に1段だけ戻す */
  onStepBack: () => void;
  canStepBack: boolean;
  /** 開いている回路がモジュールなら、それを削除する。メイン回路では出さない */
  onDeleteModule?: () => void;
}

/**
 * タブの下のツールバー。開いている回路 (シート) に効く操作を置く。
 * プロジェクト全体に効く操作はヘッダーに置く
 */
export function SheetToolbar({
  running,
  onToggleRunning,
  onStep,
  onStepBack,
  canStepBack,
  onDeleteModule,
}: SheetToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <ToolButton
        icon={running ? pauseIcon : playIcon}
        label={running ? '一時停止' : '再開'}
        title={running ? 'シミュレーションを一時停止' : 'シミュレーションを再開'}
        onClick={onToggleRunning}
      />
      <ToolButton
        icon={stepBackIcon}
        label="1 段戻す"
        title="1 段だけ時間を戻す"
        onClick={onStepBack}
        disabled={running || !canStepBack}
      />
      <ToolButton icon={stepIcon} label="1 段進める" title="1 段だけ時間を進める" onClick={onStep} disabled={running} />
      {onDeleteModule && (
        <div className={styles.end}>
          <ToolButton icon={trashIcon} label="モジュールを削除" onClick={onDeleteModule} />
        </div>
      )}
    </div>
  );
}
