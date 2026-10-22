import { Badge, Box, Flex } from '@chakra-ui/react';
import { memo, useEffect, useState } from 'react';
import { useMessages } from '../i18n/useMessages';
import { ProblemsToggle } from '../problems/ProblemsPanel';

const HINT_MIN_DURATION = 6000;

/**
 * ヒントを表示し続ける時間 (ms)。長い文ほど長く、最短でも HINT_MIN_DURATION。
 * msPerChar は 1 文字を読む時間で、言語ごとに違う (文言の表の hints.msPerChar)
 */
function hintDuration(hint: string, msPerChar: number): number {
  // 3 秒に、1 文字あたりの時間を足す (日本語は 0.25 秒で、1 秒に 4 文字ほど読む前提)
  return Math.max(HINT_MIN_DURATION, 3000 + hint.length * msPerChar);
}

interface StatusBarProps {
  /** 表示するヒント。複数あれば時間で切り替える */
  hints: string[];
  /** 回そうとしたが、シートからはみ出すため回せなかった (App が少しのあいだだけ true にする) */
  cannotRotate: boolean;
  /** 開いている回路の問題の数 (右端の「問題」に出す) */
  errors: number;
  warnings: number;
  /** 問題パネルを開いているか */
  problemsOpen: boolean;
  onToggleProblems: () => void;
}

/**
 * 画面下のステータスバー。使い方のヒントと、回せなかったことのお知らせを出す。
 * 右端に、問題の数と問題パネルの開閉 (problems/ProblemsPanel.tsx の ProblemsToggle) を置く。問題の中身はパネルに出す
 */
export const StatusBar = memo(function StatusBar({
  hints,
  cannotRotate,
  errors,
  warnings,
  problemsOpen,
  onToggleProblems,
}: StatusBarProps) {
  const m = useMessages();
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
    const timer = setTimeout(() => setIndex((i) => i + 1), hintDuration(hint, m.hints.msPerChar));
    return () => clearTimeout(timer);
  }, [hint, index, hints.length, paused, m]);

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
      <Box key={hint} flex="1" minW="0" truncate color="fg.muted" animation="fade-in 0.4s ease-out">
        {hint}
      </Box>
      {cannotRotate && (
        <Badge colorPalette="orange" variant="subtle" flexShrink={0}>
          {m.status.cannotRotate}
        </Badge>
      )}
      <ProblemsToggle
        errors={errors}
        warnings={warnings}
        open={problemsOpen}
        onToggle={onToggleProblems}
      />
    </Flex>
  );
}, sameStatus);

/** 描き直すかの判定。ヒントは描き直しのたびに新しい配列で届くので、中身の文で比べる */
function sameStatus(a: StatusBarProps, b: StatusBarProps): boolean {
  return (
    a.cannotRotate === b.cannotRotate &&
    a.errors === b.errors &&
    a.warnings === b.warnings &&
    a.problemsOpen === b.problemsOpen &&
    a.onToggleProblems === b.onToggleProblems &&
    a.hints.length === b.hints.length &&
    a.hints.every((h, i) => h === b.hints[i])
  );
}
