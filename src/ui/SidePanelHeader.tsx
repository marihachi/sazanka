import { Flex, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

/**
 * 左のサイドパネルの上の部分。上から、パネルの名前、ツールバー (アイコンのボタン) の順に並べる。
 * ツールバーのボタンのアイコンは、ほかのツールバー (16px) より少し大きい 20px にする (ToolButton の iconSize="5"。開発者が求めた)。
 * この下に、パネルの中身を置く (開発者が決めた並び)
 */
export function SidePanelHeader({
  title,
  toolbarLabel,
  toolbar,
}: {
  title: string;
  /** ツールバーの名前 (読み上げ用) */
  toolbarLabel: string;
  toolbar: ReactNode;
}) {
  return (
    <>
      <Flex h="9" px="3" align="center" flexShrink={0}>
        <Text as="h2" textStyle="sm" fontWeight="medium" truncate>
          {title}
        </Text>
      </Flex>
      <Flex
        role="toolbar"
        aria-label={toolbarLabel}
        align="center"
        gap="0.5"
        px="1"
        py="1"
        // 地をパネル (#111) より少しだけ明るくする (開発者が「暗めで」と選んだ)。
        // ボタンのポインターを載せたときの色 (gray.subtle) が地と同じになって見えないので、一段明るくする
        bg="bg.muted"
        css={{ '& button:hover:not(:disabled)': { bg: 'gray.800' } }}
        flexShrink={0}
        borderBottomWidth="1px"
      >
        {toolbar}
      </Flex>
    </>
  );
}
