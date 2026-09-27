import fitIcon from '../assets/icons/fit.svg';
import minusIcon from '../assets/icons/minus.svg';
import plusIcon from '../assets/icons/plus.svg';
import { Button, HStack } from '@chakra-ui/react';
import { ToolButton } from './ToolButton';
import { HintTooltip } from './HintTooltip';

interface ZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** 等倍に戻す */
  onReset: () => void;
  /** 回路全体が収まるように表示する */
  onFit: () => void;
}

/** シートの右下に重ねて置く、拡大縮小のボタン (置き場所は Sheet.tsx が決める) */
export function ZoomControls({
  scale,
  onZoomIn,
  onZoomOut,
  onReset,
  onFit,
}: ZoomControlsProps) {
  return (
    <HStack
      gap="0.5"
      p="0.5"
      bg="bg.panel"
      borderWidth="1px"
      rounded="l2"
      shadow="sm"
      // 入れ物 (Sheet.tsx) は素通しなので、パネルだけ受ける
      pointerEvents="auto"
      // ボタンを押したときに、シートの範囲選択などが始まらないようにする
      onPointerDown={(e) => e.stopPropagation()}
    >
      <ToolButton icon={minusIcon} label="縮小" onClick={onZoomOut} iconOnly />
      <HintTooltip content="等倍に戻す">
        <Button
          variant="ghost"
          size="sm"
          colorPalette="gray"
          // 桁数が変わってもボタンの幅が揺れないようにする
          minW="12"
          px="1"
          textStyle="xs"
          fontVariantNumeric="tabular-nums"
          onClick={onReset}
        >
          {Math.round(scale * 100)}%
        </Button>
      </HintTooltip>
      <ToolButton icon={plusIcon} label="拡大" onClick={onZoomIn} iconOnly />
      <ToolButton
        icon={fitIcon}
        label="回路全体を表示"
        onClick={onFit}
        iconOnly
      />
    </HStack>
  );
}
