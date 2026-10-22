import { Box, Flex, Text } from '@chakra-ui/react';
import { memo, useRef, useState } from 'react';
import errorIcon from '../assets/icons/error.svg';
import warningIcon from '../assets/icons/warning.svg';
import { useMessages } from '../i18n/useMessages';
import { MaskIcon } from '../ui/Icons';
import { countProblems, type Problem, type ProblemSeverity } from './problems';

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
  onToggle: () => void;
  /** 高さを変え終えた (ドラッグを離した、キーで変えた) */
  onHeightChange: (height: number) => void;
  /** 行を押した。元になっている部品や配線がある行だけ */
  onSelect: (problem: Problem) => void;
}

/**
 * シートとステータスバーの間に置く、「問題」のタブの列と問題パネル。
 * タブを押すたびに、タブの上にパネルを開閉する。開いているときは、タブとパネルを同じ背景にしてつなげて見せる。
 * パネルの上の端をドラッグすると、高さを変えられる
 */
export const ProblemsPanel = memo(function ProblemsPanel({
  problems,
  open,
  height,
  onToggle,
  onHeightChange,
  onSelect,
}: ProblemsPanelProps) {
  const m = useMessages();
  const { errors, warnings } = countProblems(problems);
  // ドラッグ中の高さ。離すまでは保存せず、ここだけで変える
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const drag = useRef<{ y: number; height: number } | null>(null);
  const shown = dragHeight ?? height;
  // エラーがあれば赤、警告だけならオレンジ、なければ灰色
  const tabColor = errors > 0 ? 'fg.error' : warnings > 0 ? 'fg.warning' : 'fg.muted';

  return (
    <Box flexShrink={0}>
      {open && (
        <Box
          position="relative"
          h={`${shown}px`}
          bg="bg.panel"
          borderTopWidth="1px"
          overflowY="auto"
          textStyle="sm"
        >
          {/* 高さを変える取っ手。パネルの上の端 */}
          <Box
            role="separator"
            aria-orientation="horizontal"
            aria-label={m.problems.resize}
            aria-valuenow={shown}
            tabIndex={0}
            position="sticky"
            top="0"
            h="1.5"
            mb="-1.5"
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
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                onHeightChange(clampHeight(height + (e.key === 'ArrowUp' ? KEY_STEP : -KEY_STEP)));
              }
            }}
          />
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
      )}
      {/* タブの列。タブは左に寄せ、開いているときはパネルと同じ背景にして、下に垂れ下がる取っ手に見せる */}
      <Flex h="6" px="2" bg="bg.subtle" borderTopWidth={open ? '0' : '1px'} align="stretch">
        <Flex
          as="button"
          align="center"
          gap="1.5"
          px="2.5"
          textStyle="xs"
          bg={open ? 'bg.panel' : 'transparent'}
          roundedBottom="l2"
          borderWidth={open ? '0 1px 1px' : '0'}
          cursor="pointer"
          _hover={{ bg: open ? 'bg.panel' : 'bg.muted' }}
          aria-expanded={open}
          aria-label={`${m.problems.tab} (${m.problems.tabCount(errors, warnings)})`}
          onClick={onToggle}
        >
          <Text as="span" fontWeight="medium">
            {m.problems.tab}
          </Text>
          <Flex as="span" align="center" gap="1" color={tabColor}>
            <MaskIcon src={errorIcon} boxSize="3" />
            {errors}
            <MaskIcon src={warningIcon} boxSize="3" ms="1" />
            {warnings}
          </Flex>
        </Flex>
      </Flex>
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
    a.onToggle === b.onToggle &&
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
