// 文字色で塗るアイコン。部品の種類のアイコンは parts/PartIcon.tsx
import { Box, type BoxProps } from '@chakra-ui/react';

/**
 * SVG をマスクとして使い、文字色 (currentColor) で塗るアイコン。
 * 大きさは Chakra の props (boxSize など) か className で指定する
 */
export function MaskIcon({ src, ...props }: { src: string } & BoxProps) {
  const mask = `url("${src}") center / contain no-repeat`;
  return (
    <Box
      as="span"
      display="inline-block"
      flexShrink={0}
      bg="currentColor"
      aria-hidden="true"
      style={{ mask, WebkitMask: mask }}
      {...props}
    />
  );
}

/** ボタンに付けるアイコン (既定は 16×16) */
export function ToolIcon({
  src,
  size = '4',
  color,
}: {
  src: string;
  size?: '4' | '5';
  /** 色。省略すると文字色 */
  color?: string;
}) {
  return <MaskIcon src={src} boxSize={size} color={color} />;
}
