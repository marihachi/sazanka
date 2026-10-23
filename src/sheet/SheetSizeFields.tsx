import { Field, HStack, Input, Stack, Text } from '@chakra-ui/react';
import type { Ref } from 'react';
import {
  isSheetCells,
  MAX_SHEET_CELLS,
  MIN_SHEET_CELLS,
  type CircuitDef,
  type CircuitSheet,
  type Project,
} from '../circuit/project';
import { fitsInSheet, minCircuitSheet } from '../geometry/view';
import { useMessages } from '../i18n/useMessages';

/** 欄の文字が、シートの 1 辺として使える値か。空欄は Number で 0 になるので、別に断る */
function isCellsText(text: string): boolean {
  return text.trim() !== '' && isSheetCells(Number(text));
}

/** シートの大きさの欄を確かめた結果 */
export interface SheetSizeCheck {
  /** 欄の値の大きさ (使える値かは widthValid と heightValid で見る) */
  draft: CircuitSheet;
  widthValid: boolean;
  heightValid: boolean;
  /** 部品と配線が収まるか。どちらかの欄が使えない値なら、調べずに true */
  fits: boolean;
  /** 部品と配線が収まるいちばん小さい大きさ。部品も配線もなければ undefined */
  min: CircuitSheet | undefined;
  /** どの欄も使える値で、収まるか */
  valid: boolean;
}

/**
 * シートの大きさの欄 (幅と高さの文字) を確かめる。回路 def の部品と配線が収まらない大きさは使えない。
 * project は、部品の大きさ (置いたモジュールのパッケージ) を引くのに使う
 */
export function checkSheetSize(
  def: CircuitDef,
  project: Project,
  widthText: string,
  heightText: string,
): SheetSizeCheck {
  const widthValid = isCellsText(widthText);
  const heightValid = isCellsText(heightText);
  const draft = { width: Number(widthText), height: Number(heightText) };
  // 収まるかは、両方の欄が使える値のときだけ調べる
  const fits = !widthValid || !heightValid || fitsInSheet(def, project, draft);
  return {
    draft,
    widthValid,
    heightValid,
    fits,
    min: minCircuitSheet(def, project),
    valid: widthValid && heightValid && fits,
  };
}

/**
 * シートの大きさ (幅と高さ、マス) の欄と、その下のエラー。回路設定のダイアログで使う。
 * 値は呼ぶ側が持ち、確かめた結果 (checkSheetSize) も呼ぶ側が渡す
 */
export function SheetSizeFields({
  widthText,
  heightText,
  onWidthChange,
  onHeightChange,
  check,
  widthRef,
}: {
  widthText: string;
  heightText: string;
  onWidthChange: (text: string) => void;
  onHeightChange: (text: string) => void;
  check: SheetSizeCheck;
  /** 幅の欄。開いたときのフォーカスに使う */
  widthRef?: Ref<HTMLInputElement>;
}) {
  const m = useMessages();
  return (
    <Stack gap="2">
      <HStack gap="3" align="start">
        <Field.Root invalid={!check.widthValid}>
          <Field.Label>{m.sheetSettings.width}</Field.Label>
          <Input
            ref={widthRef}
            type="number"
            inputMode="numeric"
            min={MIN_SHEET_CELLS}
            max={MAX_SHEET_CELLS}
            step={1}
            value={widthText}
            onChange={(e) => onWidthChange(e.target.value)}
          />
        </Field.Root>
        <Field.Root invalid={!check.heightValid}>
          <Field.Label>{m.sheetSettings.height}</Field.Label>
          <Input
            type="number"
            inputMode="numeric"
            min={MIN_SHEET_CELLS}
            max={MAX_SHEET_CELLS}
            step={1}
            value={heightText}
            onChange={(e) => onHeightChange(e.target.value)}
          />
        </Field.Root>
      </HStack>
      {/* エラーは欄の下にまとめて 1 つ出す。範囲外を先に知らせ、両方使える値になってから収まるかを知らせる */}
      {(!check.widthValid || !check.heightValid) && (
        <Text textStyle="sm" color="fg.error">
          {m.common.integerRange(MIN_SHEET_CELLS, MAX_SHEET_CELLS)}
        </Text>
      )}
      {!check.fits && check.min && (
        <Text textStyle="sm" color="fg.error">
          {/* 収まる大きさが下限より小さくても、入力できるのは下限から */}
          {m.sheetSettings.tooSmall(
            Math.max(check.min.width, MIN_SHEET_CELLS),
            Math.max(check.min.height, MIN_SHEET_CELLS),
          )}
        </Text>
      )}
    </Stack>
  );
}
