import { Box, type BoxProps } from '@chakra-ui/react';
import { type ComponentKind, isSpecialKind, type SpecialKind } from '../engine/component';
import clockIcon from '../assets/icons/clock.svg';
import inputIcon from '../assets/icons/input.svg';
import moduleIcon from '../assets/icons/module.svg';
import outputIcon from '../assets/icons/output.svg';
import { partViewOf } from './parts';

/** 特別な部品のアイコン。ほかの種類のアイコンは parts/ の見せ方にある */
const SPECIAL_ICONS: Record<SpecialKind, string> = {
  INPUT: inputIcon,
  CLOCK: clockIcon,
  OUTPUT: outputIcon,
  CUSTOM: moduleIcon,
};

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

/** ボタンに付けるアイコン (16×16) */
export function ToolIcon({ src }: { src: string }) {
  return <MaskIcon src={src} boxSize="4" />;
}

/** 部品の種類ごとのアイコン (32×24) */
export function PartIcon({ kind }: { kind: ComponentKind }) {
  const src = partViewOf(kind)?.icon ?? (isSpecialKind(kind) ? SPECIAL_ICONS[kind] : moduleIcon);
  return <MaskIcon src={src} w="8" h="6" />;
}
