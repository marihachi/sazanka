import { Box, CloseButton, Flex, Text } from '@chakra-ui/react';
import { memo, useRef, useState } from 'react';
import errorIcon from '../assets/icons/error.svg';
import warningIcon from '../assets/icons/warning.svg';
import { useMessages } from '../i18n/useMessages';
import { MaskIcon } from '../ui/Icons';
import type { Problem, ProblemSeverity } from './problems';

/** パネルの高さの下限 (px)。これより低いと、1 行も見えなくなる */
const MIN_HEIGHT = 48;
/** パネルの高さの上限の、画面の高さに対する割合。シートが見えなくならないように */
const MAX_HEIGHT_RATIO = 0.6;
/** キーボードで高さを変えるときの 1 回の量 (px) */
const KEY_STEP = 16;

/** 高さを、下限と上限の間に収める */
function clampHeight(h: number): number {
  return Math.round(Math.max(MIN_HEIGHT, Math.min(window.innerHeight * MAX_HEIGHT_RATIO, h)));
}

const SEVERITY_ICON: Record<ProblemSeverity, string> = { error: errorIcon, warning: warningIcon };
const SEVERITY_COLOR: Record<ProblemSeverity, string> = {
  error: 'fg.error',
  warning: 'fg.warning',
};

interface ProblemsPanelProps {
  /** 今のタブの回路の問題 (problems.ts の collectProblems) */
  problems: Problem[];
  open: boolean;
  /** 開いたときの高さ (px) */
  height: number;
  /** 既定の高さ (px)。取っ手をダブルクリックすると、この高さに戻す */
  defaultHeight: number;
  /** 閉じるボタンを押した */
  onClose: () => void;
  /** 高さを変え終えた (ドラッグを離した、キーで変えた) */
  onHeightChange: (height: number) => void;
  /** 行を押した。元になっている部品や配線がある行だけ */
  onSelect: (problem: Problem) => void;
}

/**
 * シートとステータスバーの間に開く問題パネル。開閉は、ステータスバーの右端の「問題」(ProblemsToggle) と、
 * パネルの右上の閉じるボタンで行う。パネルの上の端をドラッグすると高さを変えられ、ダブルクリックすると既定の高さに戻る
 */
export const ProblemsPanel = memo(function ProblemsPanel({
  problems,
  open,
  height,
  defaultHeight,
  onClose,
  onHeightChange,
  onSelect,
}: ProblemsPanelProps) {
  const m = useMessages();
  // ドラッグ中の高さ。離すまでは保存せず、ここだけで変える
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const drag = useRef<{ y: number; height: number } | null>(null);
  const shown = dragHeight ?? height;
  if (!open) {
    return null;
  }

  return (
    <Box
      flexShrink={0}
      position="relative"
      h={`${shown}px`}
      bg="bg.panel"
      borderTopWidth="1px"
      textStyle="sm"
    >
      {/* 高さを変える取っ手。パネルの上の端 */}
      <Box
        role="separator"
        aria-orientation="horizontal"
        aria-label={m.problems.resize}
        aria-valuenow={shown}
        tabIndex={0}
        position="absolute"
        top="0"
        insetX="0"
        h="1.5"
        cursor="ns-resize"
        zIndex="1"
        _hover={{ bg: 'border.emphasized' }}
        _focusVisible={{ bg: 'accent.solid', outline: 'none' }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { y: e.clientY, height: shown };
        }}
        onPointerMove={(e) => {
          if (drag.current) {
            setDragHeight(clampHeight(drag.current.height + drag.current.y - e.clientY));
          }
        }}
        onPointerUp={() => {
          if (drag.current && dragHeight !== null) {
            onHeightChange(dragHeight);
          }
          drag.current = null;
          setDragHeight(null);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragHeight(null);
        }}
        onDoubleClick={() => onHeightChange(defaultHeight)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            onHeightChange(clampHeight(height + (e.key === 'ArrowUp' ? KEY_STEP : -KEY_STEP)));
          }
        }}
      />
      {/* 閉じるボタン。ステータスバーの「問題」を押しても閉じるが、パネルの中からも閉じられるように。一覧をスクロールしても動かない */}
      <CloseButton
        size="xs"
        variant="ghost"
        colorPalette="gray"
        position="absolute"
        top="1.5"
        right="2"
        zIndex="1"
        aria-label={m.problems.close}
        title={m.problems.close}
        onClick={onClose}
      />
      {/* 閉じるボタンと重ならないよう、右を空ける */}
      <Box h="full" overflowY="auto" pe="10">
        {problems.length === 0 ? (
          <Text px="3" py="2" color="fg.muted">
            {m.problems.empty}
          </Text>
        ) : (
          <Box as="ul" py="1">
            {problems.map((p) => (
              <ProblemRow key={p.code} problem={p} onSelect={onSelect} />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}, samePanel);

/**
 * 描き直すかの判定。問題の一覧は、回路が変わるたびに (部品のドラッグの一歩ごとにも) 新しい配列で届くので、中身で比べる
 */
function samePanel(a: ProblemsPanelProps, b: ProblemsPanelProps): boolean {
  const sameIds = (x: readonly string[], y: readonly string[]) =>
    x.length === y.length && x.every((id, i) => id === y[i]);
  return (
    a.open === b.open &&
    a.height === b.height &&
    a.defaultHeight === b.defaultHeight &&
    a.onClose === b.onClose &&
    a.onHeightChange === b.onHeightChange &&
    a.onSelect === b.onSelect &&
    a.problems.length === b.problems.length &&
    a.problems.every((p, i) => {
      const q = b.problems[i];
      return (
        p.code === q.code &&
        p.count === q.count &&
        sameIds(p.parts, q.parts) &&
        sameIds(p.wires, q.wires)
      );
    })
  );
}

/**
 * ステータスバーの右端に置く「問題」のボタン。エラーと警告の数を出し、押すたびに問題パネルを開閉する。
 * 色は、エラーがあれば赤、警告だけならオレンジ、なければ灰色
 */
export function ProblemsToggle({
  errors,
  warnings,
  open,
  onToggle,
}: {
  errors: number;
  warnings: number;
  open: boolean;
  onToggle: () => void;
}) {
  const m = useMessages();
  const color = errors > 0 ? 'fg.error' : warnings > 0 ? 'fg.warning' : 'fg.muted';
  return (
    <Flex
      as="button"
      align="center"
      alignSelf="stretch"
      gap="1.5"
      px="2"
      flexShrink={0}
      rounded="l1"
      bg={open ? 'bg.muted' : 'transparent'}
      cursor="pointer"
      _hover={{ bg: 'bg.muted' }}
      aria-expanded={open}
      aria-label={`${m.problems.title} (${m.problems.countLabel(errors, warnings)})`}
      onClick={onToggle}
    >
      <Text as="span" fontWeight="medium">
        {m.problems.title}
      </Text>
      <Flex as="span" align="center" gap="1" color={color}>
        <MaskIcon src={errorIcon} boxSize="3" />
        {errors}
        <MaskIcon src={warningIcon} boxSize="3" ms="1" />
        {warnings}
      </Flex>
    </Flex>
  );
}

/**
 * 問題の 1 行。種類のアイコン、文、か所の数。
 * 元になっている部品や配線があれば押せて、押すとそれを選ぶ。なければ (発振) 押せない
 */
function ProblemRow({
  problem,
  onSelect,
}: {
  problem: Problem;
  onSelect: (problem: Problem) => void;
}) {
  const m = useMessages();
  const selectable = problem.parts.length > 0 || problem.wires.length > 0;
  const content = (
    <>
      <MaskIcon
        src={SEVERITY_ICON[problem.severity]}
        boxSize="3.5"
        color={SEVERITY_COLOR[problem.severity]}
        aria-label={m.problems[problem.severity]}
        role="img"
      />
      <Text as="span" truncate>
        {m.problems.messages[problem.code]}
      </Text>
      {problem.count !== undefined && (
        <Text as="span" color="fg.muted" flexShrink={0}>
          {m.problems.count(problem.count)}
        </Text>
      )}
    </>
  );
  return (
    <Box as="li" listStyleType="none">
      {selectable ? (
        <Flex
          as="button"
          w="full"
          align="center"
          gap="2"
          px="3"
          py="1"
          textAlign="start"
          cursor="pointer"
          _hover={{ bg: 'bg.muted' }}
          onClick={() => onSelect(problem)}
        >
          {content}
        </Flex>
      ) : (
        <Flex align="center" gap="2" px="3" py="1">
          {content}
        </Flex>
      )}
    </Box>
  );
}
