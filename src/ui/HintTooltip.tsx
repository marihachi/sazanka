import { Portal, Tooltip as ChakraTooltip } from '@chakra-ui/react';

/**
 * ボタンなどに付けるツールチップ (Chakra の Tooltip)。子要素 1 つにかぶせる。
 * 押せないボタン (disabled) はポインターのイベントを出さないので、span で包んでから渡す
 */
export function HintTooltip({
  content,
  children,
}: {
  content: React.ReactNode;
  children: React.ReactElement;
}) {
  return (
    <ChakraTooltip.Root openDelay={400} closeDelay={0}>
      <ChakraTooltip.Trigger asChild>{children}</ChakraTooltip.Trigger>
      <Portal>
        <ChakraTooltip.Positioner>
          <ChakraTooltip.Content>{content}</ChakraTooltip.Content>
        </ChakraTooltip.Positioner>
      </Portal>
    </ChakraTooltip.Root>
  );
}
