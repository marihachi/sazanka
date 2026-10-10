import {
  Button,
  Dialog as ChakraDialog,
  Field,
  HStack,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useRef, useState } from 'react';
import {
  getCircuitSheet,
  isSheetCells,
  MAX_SHEET_CELLS,
  MIN_SHEET_CELLS,
  type CircuitDef,
  type CircuitSheet,
  type Project,
} from '../circuit/project';
import { fitsInSheet, minCircuitSheet } from '../geometry/view';
import { DialogFrame } from '../ui/DialogFrame';
import { getCircuitName } from '../i18n/messages';
import { useMessages } from '../i18n/useMessages';

/** 欄の文字が、シートの 1 辺として使える値か。空欄は Number で 0 になるので、別に断る */
function isCellsText(text: string): boolean {
  return text.trim() !== '' && isSheetCells(Number(text));
}

/**
 * シート設定のダイアログ。回路のシートの大きさ (幅と高さ、マス) を変える。メイン回路にもモジュールにも使う。
 * 部品と配線が収まらない大きさにはできない (収まるいちばん小さい大きさを、エラーで知らせる)
 */
export function SheetSettingsDialog({
  def,
  project,
  onApply,
  onClose,
}: {
  def: CircuitDef;
  /** 部品の大きさ (モジュールのパッケージ) を引くのに使う */
  project: Project;
  /** 大きさを当てはめる (元に戻せる 1 回の編集にする) */
  onApply: (sheet: CircuitSheet) => void;
  onClose: () => void;
}) {
  const m = useMessages();
  const widthRef = useRef<HTMLInputElement>(null);
  const current = getCircuitSheet(def);
  const [widthText, setWidthText] = useState(String(current.width));
  const [heightText, setHeightText] = useState(String(current.height));
  const widthValid = isCellsText(widthText);
  const heightValid = isCellsText(heightText);
  const draft = { width: Number(widthText), height: Number(heightText) };
  // 収まるかは、両方の欄が使える値のときだけ調べる
  const fits = !widthValid || !heightValid || fitsInSheet(def, project, draft);
  const min = minCircuitSheet(def, project);
  const changed = draft.width !== current.width || draft.height !== current.height;
  const canApply = widthValid && heightValid && fits && changed;

  return (
    <DialogFrame
      onClose={onClose}
      initialFocus={widthRef}
      onSubmit={(e) => {
        e.preventDefault();
        if (canApply) {
          onApply(draft);
          onClose();
        }
      }}
    >
      <ChakraDialog.Header>
        <ChakraDialog.Title>{m.sheetSettings.title(getCircuitName(def, m))}</ChakraDialog.Title>
      </ChakraDialog.Header>
      <ChakraDialog.Body>
        <Stack gap="3">
          <HStack gap="3" align="start">
            <Field.Root invalid={!widthValid}>
              <Field.Label>{m.sheetSettings.width}</Field.Label>
              <Input
                ref={widthRef}
                type="number"
                inputMode="numeric"
                min={MIN_SHEET_CELLS}
                max={MAX_SHEET_CELLS}
                step={1}
                value={widthText}
                onChange={(e) => setWidthText(e.target.value)}
              />
            </Field.Root>
            <Field.Root invalid={!heightValid}>
              <Field.Label>{m.sheetSettings.height}</Field.Label>
              <Input
                type="number"
                inputMode="numeric"
                min={MIN_SHEET_CELLS}
                max={MAX_SHEET_CELLS}
                step={1}
                value={heightText}
                onChange={(e) => setHeightText(e.target.value)}
              />
            </Field.Root>
          </HStack>
          {/* エラーは欄の下にまとめて 1 つ出す。範囲外を先に知らせ、両方使える値になってから収まるかを知らせる */}
          {(!widthValid || !heightValid) && (
            <Text textStyle="sm" color="fg.error">
              {m.common.integerRange(MIN_SHEET_CELLS, MAX_SHEET_CELLS)}
            </Text>
          )}
          {!fits && min && (
            <Text textStyle="sm" color="fg.error">
              {/* 収まる大きさが下限より小さくても、入力できるのは下限から */}
              {m.sheetSettings.tooSmall(
                Math.max(min.width, MIN_SHEET_CELLS),
                Math.max(min.height, MIN_SHEET_CELLS),
              )}
            </Text>
          )}
        </Stack>
      </ChakraDialog.Body>
      <ChakraDialog.Footer>
        <Button variant="outline" colorPalette="gray" onClick={onClose}>
          {m.common.cancel}
        </Button>
        <Button type="submit" disabled={!canApply}>
          {m.sheetSettings.apply}
        </Button>
      </ChakraDialog.Footer>
    </DialogFrame>
  );
}
