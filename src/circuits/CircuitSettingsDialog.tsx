import {
  Box,
  Button,
  Dialog as ChakraDialog,
  Field,
  Flex,
  HStack,
  Input,
  NativeSelect,
  Stack,
  Tabs,
  Text,
} from '@chakra-ui/react';
import { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  applyCircuitSettings,
  assignInOrder,
  calcFittingPins,
  findDuplicatePortNames,
  getPinout,
  listPortsInNumberOrder,
  listPortsInPositionOrder,
} from '../circuit/module';
import type { Part } from '../circuit/part';
import {
  type CircuitDef,
  type CircuitSheet,
  getCircuitSheet,
  isPackage,
  MAIN_ID,
  type Package,
  type Project,
} from '../circuit/project';
import { partBounds } from '../geometry/layout';
import { getCircuitName, type Messages } from '../i18n/messages';
import { useMessages } from '../i18n/useMessages';
import { SheetPart } from '../sheet/SheetPart';
import { checkSheetSize, SheetSizeFields } from '../sheet/SheetSizeFields';
import { DialogFrame } from '../ui/DialogFrame';

type PackageKind = Package['kind'];

/** 回路設定のタブ。基本 (作者名、シートの大きさ) と、ポート (パッケージ、ポートの名前、ピンの割り当て、プレビュー) */
type SettingsTab = 'basic' | 'ports';

/** 形の種類の選択肢の並び。選択肢の文言は、言語ごとの文言の表 (i18n/) にある */
const PACKAGE_KINDS: PackageKind[] = ['dip', 'qfp', 'split'];

/** 回路設定で当てはめる設定 */
export interface CircuitSettings {
  /** 作者名 (空白だけなら空文字) */
  author: string;
  sheet: CircuitSheet;
  package: Package;
  /** ポートの部品 ID → ピン番号 */
  numbers: Map<string, number>;
  /** ポートの部品 ID → 名前 */
  portNames: Map<string, string>;
}

/**
 * 回路設定のダイアログ。開いている回路の作者名、シートの大きさ、パッケージ (形の種類とピン数)、ポートの名前、ピンの割り当てを編集する。
 * メイン回路にもほかの回路にも使う。変更は「適用」でまとめて 1 回の編集にする (onApply)。
 * 使えない値 (シートが範囲外か部品が収まらない、ピン数が使えない、ポートの名前が重なる) があれば適用できない。
 * 適用する前の設定で、モジュールとして置いたときの見え方をプレビューに出す
 */
export function CircuitSettingsDialog({
  def,
  project,
  onApply,
  onClose,
}: {
  /** 設定する回路 */
  def: CircuitDef;
  /** シートに部品が収まるか (置いたモジュールの大きさ) とプレビューに使う */
  project: Project;
  onApply: (settings: CircuitSettings) => void;
  onClose: () => void;
}) {
  const m = useMessages();
  const widthRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<SettingsTab>('basic');
  const isMain = def.id === MAIN_ID;
  const [author, setAuthor] = useState(def.author ?? '');
  const currentSheet = getCircuitSheet(def);
  const [widthText, setWidthText] = useState(String(currentSheet.width));
  const [heightText, setHeightText] = useState(String(currentSheet.height));
  const sheetCheck = useMemo(
    () => checkSheetSize(def, project, widthText, heightText),
    [def, project, widthText, heightText],
  );
  const sheetChanged =
    sheetCheck.draft.width !== currentSheet.width ||
    sheetCheck.draft.height !== currentSheet.height;
  // ポートの並び。一覧と選択肢はポート番号の順 (見出しが番号のため)、番号を振るときは位置の順 (上から順に振るため)
  const ports = useMemo(() => listPortsInNumberOrder(def), [def]);
  const portsByPosition = useMemo(() => listPortsInPositionOrder(def), [def]);
  const initial = def.package ?? { kind: 'split' };
  const [kind, setKind] = useState<PackageKind>(initial.kind);
  const [pinsText, setPinsText] = useState(
    'pins' in initial ? String(initial.pins) : String(calcFittingPins('dip', ports.length)),
  );
  // ピンの割り当ての下書き。開いたときの番号から、重なり (2 つめ以降) を除いて始める
  const [numbers, setNumbers] = useState(() => initialNumbers(ports));
  // ポートの名前の下書き (部品 ID → 入力中の文字)
  const [portNames, setPortNames] = useState(
    () => new Map(ports.map((c) => [c.id, c.portName ?? ''])),
  );
  // 名前の一覧とプレビューは、打つたびに 128 行の選択肢を作り直すと重いので、入力より遅れて描き直してよい
  const deferredPortNames = useDeferredValue(portNames);
  const duplicates = useMemo(() => findDuplicatePortNames(portNames), [portNames]);

  const pins = Number(pinsText);
  const draft: Package = kind === 'split' ? { kind } : { kind, pins };
  const valid = isPackage(draft);
  const applied = valid ? applyCircuitSettings(def, draft, numbers, portNames) : undefined;
  const pinsChanged = applied !== undefined && !samePins(def, applied);
  const authorText = author.trim();
  const changed =
    applied !== undefined &&
    (pinsChanged ||
      !samePortNames(def, applied) ||
      sheetChanged ||
      authorText !== (def.author ?? ''));
  const canApply = changed && sheetCheck.valid && duplicates.size === 0;
  const preview = valid ? applyCircuitSettings(def, draft, numbers, deferredPortNames) : def;

  const changePortName = useCallback((id: string, text: string) => {
    setPortNames((cur) => new Map(cur).set(id, text));
  }, []);

  /** 形の種類を変える。ピン数は、新しい種類で使える数に直す。split から変えるときは、上から順に番号を割り当てる */
  function changeKind(next: PackageKind) {
    setKind(next);
    if (next === 'split') {
      return;
    }
    const current = Number.isInteger(pins) ? pins : 0;
    const fitted = calcFittingPins(next, Math.max(current, ports.length));
    setPinsText(String(isPackage({ kind: next, pins: current }) ? current : fitted));
    if (kind === 'split') {
      setNumbers(assignInOrder(portsByPosition, fitted));
    }
  }

  /**
   * ピン番号 n に、ポート id を割り当てる (id が空なら NC)。そのポートの前の番号と、n の前のポートは外す。
   * 行 (PinRow) の描き直しを省けるよう、同じ関数を渡し続ける
   */
  const assign = useCallback((n: number, id: string) => {
    setNumbers((cur) => {
      const next = new Map([...cur].filter(([k, v]) => k !== id && v !== n));
      if (id) {
        next.set(id, n);
      }
      return next;
    });
  }, []);
  // ポートの名前と、行の選択肢。どの行でも同じなので 1 回だけ作り、行どうしで使い回す
  const names = useMemo(
    () => new Map(ports.map((c) => [c.id, getPortName(c, deferredPortNames.get(c.id) ?? '', m)])),
    [ports, deferredPortNames, m],
  );
  const options = useMemo(
    () => [
      <option key="" value="">
        NC
      </option>,
      ...ports.map((c) => (
        <option key={c.id} value={c.id}>
          {names.get(c.id)}
        </option>
      )),
    ],
    [ports, names],
  );

  const numbered = valid && kind !== 'split';
  const portAt = new Map([...numbers].map(([id, n]) => [n, id]));
  const unassigned = numbered
    ? ports.filter((c) => {
        const n = numbers.get(c.id);
        return n === undefined || n > pins;
      })
    : [];

  return (
    <DialogFrame
      onClose={onClose}
      initialFocus={widthRef}
      size="lg"
      onSubmit={(e) => {
        e.preventDefault();
        if (canApply) {
          onApply({
            author: authorText,
            sheet: sheetCheck.draft,
            package: draft,
            numbers,
            portNames,
          });
          onClose();
        }
      }}
    >
      <ChakraDialog.Header>
        <ChakraDialog.Title>{m.circuitSettings.title(getCircuitName(def, m))}</ChakraDialog.Title>
      </ChakraDialog.Header>
      {/* 種類やピン数、出ている注意、タブで高さが変わらないよう、本文の高さは決めておき、中でスクロールする */}
      <ChakraDialog.Body h="min(36rem, 70vh)" flex="none" overflowY="auto">
        <Tabs.Root
          value={tab}
          onValueChange={(e) => setTab(e.value as SettingsTab)}
          variant="line"
          size="sm"
          display="flex"
          flexDirection="column"
          h={{ md: 'full' }}
        >
          <Tabs.List>
            <SettingsTabTrigger
              value="basic"
              label={m.circuitSettings.tabs.basic}
              invalid={!sheetCheck.valid}
            />
            <SettingsTabTrigger
              value="ports"
              label={m.circuitSettings.tabs.ports}
              invalid={!valid || duplicates.size > 0}
            />
          </Tabs.List>
          <Tabs.Content value="basic">
            <Stack gap="5" maxW="sm">
              <Field.Root>
                <Field.Label>{m.circuitSettings.author}</Field.Label>
                <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
              </Field.Root>
              <SheetSizeFields
                widthText={widthText}
                heightText={heightText}
                onWidthChange={setWidthText}
                onHeightChange={setHeightText}
                check={sheetCheck}
                widthRef={widthRef}
              />
            </Stack>
          </Tabs.Content>
          {/* 中で Flex を高さいっぱいに広げる。Tabs.Content に display を書くと、選んでいないときに隠れなくなる */}
          <Tabs.Content value="ports" flex={{ md: '1' }} minH="0">
            <Flex direction={{ base: 'column', md: 'row' }} gap="6" h={{ md: 'full' }}>
              <Stack gap="5" flex="1" minW="0" minH="0">
                <HStack gap="3" align="start">
                  <Field.Root flex="1">
                    <Field.Label>{m.circuitSettings.package}</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={kind}
                        onChange={(e) => changeKind(e.target.value as PackageKind)}
                      >
                        {PACKAGE_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {m.circuitSettings.packages[k]}
                          </option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>
                  {kind !== 'split' && (
                    <Field.Root invalid={!valid} w="28">
                      <Field.Label>{m.circuitSettings.pins}</Field.Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        step={kind === 'dip' ? 2 : 4}
                        min={kind === 'dip' ? 4 : 8}
                        max={256}
                        value={pinsText}
                        onChange={(e) => setPinsText(e.target.value)}
                      />
                    </Field.Root>
                  )}
                </HStack>
                {!valid && (
                  <Text textStyle="sm" color="fg.error">
                    {kind === 'dip'
                      ? m.circuitSettings.dipPinsError
                      : m.circuitSettings.qfpPinsError}
                  </Text>
                )}
                {kind === 'split' && (
                  <Text textStyle="sm" color="fg.muted">
                    {m.circuitSettings.splitHelp}
                  </Text>
                )}
                <Stack gap="2" flex={{ md: '1' }} minH="0">
                  <Text textStyle="sm" fontWeight="medium">
                    {m.circuitSettings.ports}
                  </Text>
                  <Stack
                    gap="1"
                    flex={{ md: '1' }}
                    minH="0"
                    maxH={{ base: '60', md: 'none' }}
                    overflowY="auto"
                    pe="1"
                  >
                    {ports.map((c) => (
                      <PortRow
                        key={c.id}
                        id={c.id}
                        heading={m.common.portName(c.kind, c.portNumber ?? '')}
                        value={portNames.get(c.id) ?? ''}
                        duplicate={duplicates.has(c.id)}
                        onChange={changePortName}
                      />
                    ))}
                  </Stack>
                  {duplicates.size > 0 && (
                    <Text textStyle="sm" color="fg.error">
                      {m.circuitSettings.duplicatePortName}
                    </Text>
                  )}
                </Stack>
                {numbered && (
                  <Stack gap="2" flex={{ md: '1' }} minH="0">
                    <HStack justify="space-between">
                      <Text textStyle="sm" fontWeight="medium">
                        {m.circuitSettings.assignment}
                      </Text>
                      <Button
                        size="xs"
                        variant="outline"
                        colorPalette="gray"
                        onClick={() => setNumbers(assignInOrder(portsByPosition, pins))}
                      >
                        {m.circuitSettings.assignInOrder}
                      </Button>
                    </HStack>
                    <Stack
                      gap="1"
                      flex={{ md: '1' }}
                      minH="0"
                      maxH={{ base: '60', md: 'none' }}
                      overflowY="auto"
                      pe="1"
                    >
                      {Array.from({ length: pins }, (_, i) => i + 1).map((n) => (
                        <PinRow
                          key={n}
                          n={n}
                          value={portAt.get(n) ?? ''}
                          options={options}
                          onAssign={assign}
                        />
                      ))}
                    </Stack>
                    {unassigned.length > 0 && (
                      <Text textStyle="sm" color="fg.warning">
                        {m.circuitSettings.unassigned}{' '}
                        {unassigned
                          .map((c) => names.get(c.id))
                          .join(m.circuitSettings.listSeparator)}
                      </Text>
                    )}
                  </Stack>
                )}
                {/* メイン回路は置く先がないので、置いた先の配線の注意は要らない */}
                {pinsChanged && !isMain && (
                  <Text textStyle="sm" color="fg.warning">
                    {m.circuitSettings.wiringWarning}
                  </Text>
                )}
              </Stack>
              <Stack gap="2" w={{ base: 'full', md: '72' }} flexShrink={0}>
                <Text textStyle="sm" fontWeight="medium">
                  {m.circuitSettings.preview}
                </Text>
                <Preview def={preview} project={project} />
              </Stack>
            </Flex>
          </Tabs.Content>
        </Tabs.Root>
      </ChakraDialog.Body>
      <ChakraDialog.Footer>
        <Button variant="outline" colorPalette="gray" onClick={onClose}>
          {m.common.cancel}
        </Button>
        <Button type="submit" disabled={!canApply}>
          {m.circuitSettings.apply}
        </Button>
      </ChakraDialog.Footer>
    </DialogFrame>
  );
}

/**
 * ピンの割り当ての 1 行。ピン番号と、割り当てるポートの選択欄。
 * ピン数が多い (128 ピンなど) と、1 つ変えるたびに全部の行を描き直すと重いので、memo で変わった行だけを描き直す
 */
const PinRow = memo(function PinRow({
  n,
  value,
  options,
  onAssign,
}: {
  n: number;
  /** 割り当てているポートの部品 ID。NC なら空 */
  value: string;
  options: React.ReactNode;
  onAssign: (n: number, id: string) => void;
}) {
  const m = useMessages();
  return (
    <HStack gap="2">
      <Text textStyle="sm" w="8" textAlign="end" color="fg.muted">
        {n}
      </Text>
      <NativeSelect.Root size="sm">
        <NativeSelect.Field
          aria-label={m.circuitSettings.pinLabel(n)}
          value={value}
          onChange={(e) => onAssign(n, e.target.value)}
        >
          {options}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </HStack>
  );
});

/**
 * ポートの 1 行。入力か出力かとポート番号と、名前の入力欄。
 * ポートが多いと、1 文字打つたびに全部の行を描き直すと重いので、memo で変わった行だけを描き直す
 */
const PortRow = memo(function PortRow({
  id,
  heading,
  value,
  duplicate,
  onChange,
}: {
  id: string;
  /** 「入力 1」の形の見出し */
  heading: string;
  /** 入力中の名前 */
  value: string;
  /** ほかのポートと名前が重なっているか */
  duplicate: boolean;
  onChange: (id: string, text: string) => void;
}) {
  const m = useMessages();
  return (
    <HStack gap="2">
      <Text textStyle="sm" w="14" flexShrink={0} color="fg.muted">
        {heading}
      </Text>
      <Field.Root invalid={duplicate}>
        <Input
          size="sm"
          aria-label={m.circuitSettings.portLabelOf(heading)}
          placeholder={m.circuitSettings.noName}
          value={value}
          onChange={(e) => onChange(id, e.target.value)}
        />
      </Field.Root>
    </HStack>
  );
});

/**
 * 適用する前の設定で、モジュールをシート上に置いたときの見え方。シート上の部品の描画 (SheetPart) をそのまま使う。
 * 部品の占める範囲 (ピンの先と名前を含む) が収まるよう、SVG の viewBox を合わせる
 */
function Preview({ def, project }: { def: CircuitDef; project: Project }) {
  const m = useMessages();
  const part: Part = { id: 'preview', kind: 'module', circuitId: def.id, x: 0, y: 0 };
  // 下書きの回路で、ピンの割り当てを求める
  const draftProject: Project = {
    ...project,
    circuits: project.circuits.map((d) => (d.id === def.id ? def : d)),
  };
  const pinout = getPinout(part, draftProject);
  const r = partBounds(part, pinout);
  // ピン番号の文字の分、少し余白を足す
  const pad = 12;
  const viewBox = `${r.left - pad} ${r.top - pad} ${r.right - r.left + pad * 2} ${r.bottom - r.top + pad * 2}`;
  return (
    <Box bg="sheet.bg" rounded="l2" borderWidth="1px" h="72">
      <svg
        viewBox={viewBox}
        width="100%"
        height="100%"
        role="img"
        aria-label={m.circuitSettings.previewLabel}
      >
        <SheetPart
          comp={part}
          pinout={pinout}
          name={getCircuitName(def, m)}
          inputValues={pinout.inputs.map(() => false)}
          outputValues={pinout.outputs.map(() => false)}
          selected={false}
          showPinNumbers
          onBodyDown={() => {}}
          onBodyDoubleClick={() => {}}
        />
      </svg>
    </Box>
  );
}

/**
 * 開いたときのピンの割り当て (部品 ID → 番号)。同じ番号のポートが 2 つ以上あれば、並びの先頭のものだけを残す。
 * ports は一覧の並び (ポート番号の順) なので、一覧で先に出るポートに番号が残る
 */
function initialNumbers(ports: readonly Part[]): Map<string, number> {
  const numbers = new Map<string, number>();
  const used = new Set<number>();
  for (const c of ports) {
    if (c.pinNumber !== undefined && !used.has(c.pinNumber)) {
      numbers.set(c.id, c.pinNumber);
      used.add(c.pinNumber);
    }
  }
  return numbers;
}

/**
 * 一覧に出すポートの名前。「入力 1 A」「出力 2 S」のように、入力か出力かと、ポート番号と、名前 (text) で示す。
 * 名前が空白だけなら「入力 1 (名前未設定)」とする
 */
function getPortName(c: Part, text: string, m: Messages): string {
  return m.circuitSettings.portOption(m.common.portName(c.kind, c.portNumber ?? ''), text.trim());
}

/** パッケージとポートのピン番号が同じか (外の配線に響く変更がないか) */
function samePins(a: CircuitDef, b: CircuitDef): boolean {
  return (
    JSON.stringify(a.package ?? { kind: 'split' }) === JSON.stringify(b.package) &&
    a.parts.every((c, i) => c.pinNumber === b.parts[i].pinNumber)
  );
}

/** ポートの名前が同じか */
function samePortNames(a: CircuitDef, b: CircuitDef): boolean {
  return a.parts.every((c, i) => c.portName === b.parts[i].portName);
}

/** 回路設定のタブの見出し。使えない値があるタブには、ほかのタブからでも分かるよう、赤い印を付ける (適用を押せない理由を探せるように) */
function SettingsTabTrigger({
  value,
  label,
  invalid,
}: {
  value: SettingsTab;
  label: string;
  invalid: boolean;
}) {
  const m = useMessages();
  return (
    <Tabs.Trigger value={value}>
      {label}
      {invalid && (
        <Box
          as="span"
          w="2"
          h="2"
          borderRadius="full"
          bg="fg.error"
          aria-label={m.circuitSettings.tabs.invalid}
          role="img"
        />
      )}
    </Tabs.Trigger>
  );
}
