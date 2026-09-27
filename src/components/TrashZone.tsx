import { memo } from 'react';
import { Box, Flex } from '@chakra-ui/react';
import trashIcon from '../assets/icons/trash.svg';
import { MaskIcon } from './Icons';

interface TrashZoneProps {
  /** 部品をドラッグ中か。'trash' は削除エリアの上 */
  dragMode: 'none' | 'moving' | 'trash';
  /** 部品を落としたかの判定に、画面上の位置を使う (Sheet.tsx) */
  ref: React.Ref<HTMLDivElement>;
}

/**
 * 部品をドラッグして落とすと削除するエリア。シートの右下、ズームのパネルの上に重ねて置く。
 * ふだんは丸いごみ箱のアイコンだけ。部品をドラッグし始めると、丸の下 (外) に「削除」と出す。上に載せると丸を赤くする。
 * 丸の位置と大きさは、ドラッグの前後で変えない (開発者の方針)
 */
export const TrashZone = memo(function TrashZone({
  dragMode,
  ref,
}: TrashZoneProps) {
  const dragging = dragMode !== 'none';
  const over = dragMode === 'trash';
  return (
    // 丸と、その下の「削除」の文字。部品を落とす判定は丸の範囲だけ (ref は丸に付ける)
    <Flex direction="column" align="center" gap="1">
      <Flex
        ref={ref}
        align="center"
        justify="center"
        boxSize="12"
        rounded="full"
        borderWidth="1px"
        shadow="sm"
        bg={over ? 'red.solid' : 'bg.panel'}
        color={over ? 'red.contrast' : dragging ? 'fg' : 'fg.muted'}
        borderColor={
          over ? 'red.solid' : dragging ? 'border.emphasized' : 'border'
        }
        transition="all 0.15s ease-out"
        // 入れ物 (Sheet.tsx) と文字の場所は素通しなので、丸だけ受ける
        pointerEvents="auto"
        aria-label="ここへドラッグで削除"
        // シートの範囲選択などが始まらないようにする
        onPointerDown={(e) => e.stopPropagation()}
      >
        <MaskIcon src={trashIcon} boxSize="6" />
      </Flex>
      {/* 文字の場所はいつも空けておき、ドラッグ中だけ見せる。出し入れで丸の位置がずれないようにするため */}
      <Box
        as="span"
        textStyle="sm"
        fontWeight="semibold"
        color={over ? 'fg.error' : 'fg'}
        visibility={dragging ? 'visible' : 'hidden'}
        aria-hidden={!dragging}
      >
        削除
      </Box>
    </Flex>
  );
});
