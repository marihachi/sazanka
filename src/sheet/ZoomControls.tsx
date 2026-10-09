import { memo } from 'react';
import fitIcon from '../assets/icons/fit.svg';
import minusIcon from '../assets/icons/minus.svg';
import plusIcon from '../assets/icons/plus.svg';
import { Button, HStack } from '@chakra-ui/react';
import { ToolButton } from '../ui/ToolButton';
import { HintTooltip } from '../ui/HintTooltip';
import { useMessages } from '../i18n/useMessages';

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
export const ZoomControls = memo(function ZoomControls({
  scale,
  onZoomIn,
  onZoomOut,
  onReset,
  onFit,
}: ZoomControlsProps) {
  const m = useMessages();
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
      <ToolButton icon={minusIcon} label={m.sheet.zoomOut} onClick={onZoomOut} iconOnly />
      <HintTooltip content={m.sheet.zoomReset}>
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
      <ToolButton icon={plusIcon} label={m.sheet.zoomIn} onClick={onZoomIn} iconOnly />
      <ToolButton icon={fitIcon} label={m.sheet.fit} onClick={onFit} iconOnly />
    </HStack>
  );
});
