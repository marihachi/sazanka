import { Box, Button, IconButton, Separator } from '@chakra-ui/react';
import { ToolIcon } from './Icons';
import { HintTooltip } from './HintTooltip';

interface ToolButtonProps {
  icon: string;
  label: string;
  /** ツールチップ。省略すると label */
  title?: string;
  onClick: () => void;
  disabled?: boolean;
  /** 文字を出さず、アイコンだけにする (環境設定など) */
  iconOnly?: boolean;
  /** 取り消しにくい危険な操作 (回路の削除など)。赤で表示する */
  danger?: boolean;
  /** 切り替えのボタンで、今選ばれている (選択モード・配線モードなど)。地の色を付けて示す */
  active?: boolean;
  /** アイコンの大きさ。既定は 16px ('4')。サイドパネルのツールバーは 20px ('5') */
  iconSize?: '4' | '5';
}

/**
 * アイコン付きのボタン (ヘッダー、シートのツールバーで共有)。
 * 狭い画面 (Chakra の md 未満) では文字を隠してアイコンだけにする。文字は aria-label とツールチップに残す
 */
export function ToolButton({
  icon,
  label,
  title,
  onClick,
  disabled,
  iconOnly,
  danger,
  active,
  iconSize,
}: ToolButtonProps) {
  const common = {
    variant: active ? 'subtle' : 'ghost',
    size: 'sm',
    // ボタンの文字はアクセントカラーにせず、灰色で出す
    colorPalette: danger ? 'red' : 'gray',
    onClick,
    disabled,
    'aria-label': label,
    'aria-pressed': active,
  } as const;
  const button = iconOnly ? (
    <IconButton {...common}>
      <ToolIcon src={icon} size={iconSize} />
    </IconButton>
  ) : (
    <Button {...common} flexShrink={0} px={{ base: '2', md: '2.5' }}>
      <ToolIcon src={icon} size={iconSize} />
      <Box as="span" display={{ base: 'none', md: 'inline' }}>
        {label}
      </Box>
    </Button>
  );
  return (
    <HintTooltip content={title ?? label}>
      {/* 押せないボタンはポインターのイベントを出さないので、包んだ span でツールチップを出す */}
      {disabled ? (
        <Box as="span" display="inline-flex" flexShrink={0}>
          {button}
        </Box>
      ) : (
        button
      )}
    </HintTooltip>
  );
}

/** ボタンの区切りの縦線 */
export function ToolDivider() {
  return <Separator orientation="vertical" h="5" mx="1" />;
}
