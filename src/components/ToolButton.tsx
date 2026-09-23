import { classNames } from './classNames';
import { ToolIcon } from './Icons';
import styles from './ToolButton.module.css';

interface ToolButtonProps {
  icon: string;
  label: string;
  /** ツールチップ。省略すると label */
  title?: string;
  onClick: () => void;
  disabled?: boolean;
  /** 文字を出さず、アイコンだけにする (タブの「+」など) */
  iconOnly?: boolean;
  /** 取り消しにくい危険な操作 (モジュールの削除など)。赤で表示する */
  danger?: boolean;
}

/**
 * アイコン付きのボタン (ヘッダー、シートのツールバー、タブの「+」で共有)。
 * 狭い画面では文字を隠してアイコンだけにする。文字は aria-label とツールチップに残す
 */
export function ToolButton({
  icon,
  label,
  title,
  onClick,
  disabled,
  iconOnly,
  danger,
}: ToolButtonProps) {
  return (
    <button
      className={classNames(
        styles.tool,
        iconOnly && styles.iconOnly,
        danger && styles.danger,
      )}
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      aria-label={label}
    >
      <ToolIcon src={icon} />
      {!iconOnly && <span className={styles.label}>{label}</span>}
    </button>
  );
}

/** ボタンの区切りの縦線 */
export function ToolDivider() {
  return <span className={styles.divider} />;
}
