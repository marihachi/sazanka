import { Badge, Box, Flex } from '@chakra-ui/react';
import { useEffect, useState } from 'react';

const HINT_MIN_DURATION = 6000;

/** ヒントを表示し続ける時間 (ms)。長い文ほど長く、最短でも HINT_MIN_DURATION */
function hintDuration(hint: string): number {
  return Math.max(HINT_MIN_DURATION, 3000 + hint.length * 250);
}

interface StatusBarProps {
  /** 表示するヒント。複数あれば時間で切り替える */
  hints: string[];
  unstable: boolean;
}

/** 画面下のステータスバー。使い方のヒントと、発振の警告を出す */
export function StatusBar({ hints, unstable }: StatusBarProps) {
  const hintKey = hints.join('|');
  const [index, setIndex] = useState(0);
  /** マウスが載っている間は切り替えを止める */
  const [paused, setPaused] = useState(false);
  // ヒントの内容が変わったら最初から表示し直す
  // biome-ignore lint/correctness/useExhaustiveDependencies: hintKey が変わったことをきっかけに戻すための依存
  useEffect(() => setIndex(0), [hintKey]);
  const hint = hints[index % hints.length];
  // 読み終えられるだけの時間を置いてから次のヒントへ切り替える
  // biome-ignore lint/correctness/useExhaustiveDependencies: index は、同じ文言のヒントが続いてもタイマーを張り直すための依存
  useEffect(() => {
    if (hints.length < 2 || paused) {
      return;
    }
    const timer = setTimeout(() => setIndex((i) => i + 1), hintDuration(hint));
    return () => clearTimeout(timer);
  }, [hint, index, hints.length, paused]);

  return (
    <Flex
      as="footer"
      align="center"
      gap="4"
      minH="6"
      px="2.5"
      py="0.5"
      textStyle="xs"
      bg="bg.subtle"
      borderTopWidth="1px"
      // ヒントの切り替え効果で中身が動いてもはみ出さない
      overflow="hidden"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      {/* 切り替わるたびに (key が変わるので) ふわっと表示する */}
      <Box
        key={hint}
        flex="1"
        minW="0"
        truncate
        color="fg.muted"
        animation="fade-in 0.4s ease-out"
      >
        {hint}
      </Box>
      {unstable && (
        <Badge colorPalette="red" variant="subtle" flexShrink={0}>
          発振しています
        </Badge>
      )}
    </Flex>
  );
}
