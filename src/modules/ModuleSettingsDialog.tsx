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
  Text,
} from '@chakra-ui/react';
import { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  applyModuleSettings,
  assignInOrder,
  calcFittingPins,
  findDuplicateLabels,
  getPinout,
  listPortsInPositionOrder,
} from '../circuit/module';
import type { Part } from '../circuit/part';
import { type CircuitDef, isPackage, type Package, type Project } from '../circuit/project';
import { partBounds } from '../geometry/layout';
import { SheetPart } from '../sheet/SheetPart';
import { DialogFrame } from '../ui/DialogFrame';

type PackageKind = Package['kind'];

/** 形の種類の選択肢。並び順が選択肢の順 */
const PACKAGE_KINDS: { value: PackageKind; label: string }[] = [
  { value: 'dip', label: 'DIP (左右の 2 辺にピン)' },
  { value: 'qfp', label: 'QFP (4 辺にピン)' },
  { value: 'split', label: 'ロジック (入力は左、出力は右)' },
];

/**
 * モジュール設定のダイアログ。開いているモジュールのパッケージ (形の種類とピン数) と、ポートの名前と、ピンの割り当てを編集する。
 * 変更は「適用」でまとめて 1 回の編集にする (onApply)。適用する前の設定で、シート上での見え方を見本に出す
 */
export function ModuleSettingsDialog({
  def,
  project,
  onApply,
  onClose,
}: {
  /** 設定するモジュールの回路 */
  def: CircuitDef;
  project: Project;
  /** 設定を当てはめる。numbers はポートの部品 ID → ピン番号、labels はポートの部品 ID → 名前 */
  onApply: (pkg: Package, numbers: Map<string, number>, labels: Map<string, string>) => void;
  onClose: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const ports = useMemo(() => listPortsInPositionOrder(def), [def]);
  const initial = def.package ?? { kind: 'split' };
  const [kind, setKind] = useState<PackageKind>(initial.kind);
  const [pinsText, setPinsText] = useState(
    'pins' in initial ? String(initial.pins) : String(calcFittingPins('dip', ports.length)),
  );
  // ピンの割り当ての下書き。開いたときの番号から、重なり (2 つめ以降) を除いて始める
  const [numbers, setNumbers] = useState(() => initialNumbers(ports));
  // ポートの名前の下書き (部品 ID → 入力中の文字)
  const [labels, setLabels] = useState(() => new Map(ports.map((c) => [c.id, c.label ?? ''])));
  // 名前の一覧と見本は、打つたびに 128 行の選択肢を作り直すと重いので、入力より遅れて描き直してよい
  const deferredLabels = useDeferredValue(labels);
  const duplicates = useMemo(() => findDuplicateLabels(labels), [labels]);

  const pins = Number(pinsText);
  const draft: Package = kind === 'split' ? { kind } : { kind, pins };
  const valid = isPackage(draft);
  const applied = valid ? applyModuleSettings(def, draft, numbers, labels) : undefined;
  const pinsChanged = applied !== undefined && !samePins(def, applied);
  const changed = applied !== undefined && (pinsChanged || !sameLabels(def, applied));
  const preview = valid ? applyModuleSettings(def, draft, numbers, deferredLabels) : def;

  const changeLabel = useCallback((id: string, text: string) => {
    setLabels((cur) => new Map(cur).set(id, text));
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
      setNumbers(assignInOrder(ports, fitted));
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
    () => new Map(ports.map((c) => [c.id, getPortName(c, deferredLabels.get(c.id) ?? '')])),
    [ports, deferredLabels],
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
      initialFocus={cancelRef}
      size="lg"
      onSubmit={(e) => {
        e.preventDefault();
        if (applied && changed && duplicates.size === 0) {
          onApply(draft, numbers, labels);
          onClose();
        }
      }}
    >
      <ChakraDialog.Header>
        <ChakraDialog.Title>モジュール設定: {def.name}</ChakraDialog.Title>
      </ChakraDialog.Header>
      {/* 種類やピン数、出ている注意で高さが変わらないよう、本文の高さは決めておき、中でスクロールする */}
      <ChakraDialog.Body h="min(36rem, 70vh)" flex="none" overflowY="auto">
        <Flex direction={{ base: 'column', md: 'row' }} gap="6" h={{ md: 'full' }}>
          <Stack gap="5" flex="1" minW="0" minH="0">
            <HStack gap="3" align="start">
              <Field.Root flex="1">
                <Field.Label>パッケージ</Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    value={kind}
                    onChange={(e) => changeKind(e.target.value as PackageKind)}
                  >
                    {PACKAGE_KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field.Root>
              {kind !== 'split' && (
                <Field.Root invalid={!valid} w="28">
                  <Field.Label>ピン数</Field.Label>
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
                  ? 'DIP のピン数は、4〜256 の偶数で入力してください'
                  : 'QFP のピン数は、8〜256 の 4 の倍数で入力してください'}
              </Text>
            )}
            {kind === 'split' && (
              <Text textStyle="sm" color="fg.muted">
                入力は左、出力は右に、中の位置の順 (上から、同じ高さなら左から)
                に並びます。ピン番号は使いません。
              </Text>
            )}
            <Stack gap="2" flex={{ md: '1' }} minH="0">
              <Text textStyle="sm" fontWeight="medium">
                ポート
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
                    heading={`${c.kind === 'input' ? '入力' : '出力'} ${c.portNumber ?? ''}`}
                    value={labels.get(c.id) ?? ''}
                    duplicate={duplicates.has(c.id)}
                    onChange={changeLabel}
                  />
                ))}
              </Stack>
              {duplicates.size > 0 && (
                <Text textStyle="sm" color="fg.error">
                  ほかのポートと同じ名前は付けられません
                </Text>
              )}
            </Stack>
            {numbered && (
              <Stack gap="2" flex={{ md: '1' }} minH="0">
                <HStack justify="space-between">
                  <Text textStyle="sm" fontWeight="medium">
                    ピンの割り当て
                  </Text>
                  <Button
                    size="xs"
                    variant="outline"
                    colorPalette="gray"
                    onClick={() => setNumbers(assignInOrder(ports, pins))}
                  >
                    上から順に割り当て直す
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
                    割り当てのないポート (外側のピンに出ない):{' '}
                    {unassigned.map((c) => names.get(c.id)).join('、')}
                  </Text>
                )}
              </Stack>
            )}
            {pinsChanged && (
              <Text textStyle="sm" color="fg.warning">
                パッケージやピンの割り当てを変更すると、このモジュールの配置先で、配線の接続先が変わったり配線が切断されたりすることがあります。必ず状況を確認するようにしてください。
              </Text>
            )}
          </Stack>
          <Stack gap="2" w={{ base: 'full', md: '72' }} flexShrink={0}>
            <Text textStyle="sm" fontWeight="medium">
              見本
            </Text>
            <Preview def={preview} project={project} />
          </Stack>
        </Flex>
      </ChakraDialog.Body>
      <ChakraDialog.Footer>
        <Button ref={cancelRef} variant="outline" colorPalette="gray" onClick={onClose}>
          キャンセル
        </Button>
        <Button type="submit" disabled={!changed || duplicates.size > 0}>
          適用
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
  return (
    <HStack gap="2">
      <Text textStyle="sm" w="8" textAlign="end" color="fg.muted">
        {n}
      </Text>
      <NativeSelect.Root size="sm">
        <NativeSelect.Field
          aria-label={`${n} 番のピン`}
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
  return (
    <HStack gap="2">
      <Text textStyle="sm" w="14" flexShrink={0} color="fg.muted">
        {heading}
      </Text>
      <Field.Root invalid={duplicate}>
        <Input
          size="sm"
          aria-label={`${heading} の名前`}
          placeholder="名前未設定"
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
  const part: Part = { id: 'preview', kind: 'module', module: def.id, x: 0, y: 0 };
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
      <svg viewBox={viewBox} width="100%" height="100%" role="img" aria-label="モジュールの見本">
        <SheetPart
          comp={part}
          pinout={pinout}
          name={def.name}
          inputValues={pinout.inputs.map(() => false)}
          outputValues={pinout.outputs.map(() => false)}
          selected={false}
          onBodyDown={() => {}}
          onBodyDoubleClick={() => {}}
        />
      </svg>
    </Box>
  );
}

/** 開いたときのピンの割り当て (部品 ID → 番号)。同じ番号のポートが 2 つ以上あれば、並びの先頭のものだけを残す */
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
function getPortName(c: Part, text: string): string {
  const side = c.kind === 'input' ? '入力' : '出力';
  return `${side} ${c.portNumber ?? ''} ${text.trim() || '(名前未設定)'}`;
}

/** パッケージとポートのピン番号が同じか (外の配線に響く変更がないか) */
function samePins(a: CircuitDef, b: CircuitDef): boolean {
  return (
    JSON.stringify(a.package ?? { kind: 'split' }) === JSON.stringify(b.package) &&
    a.parts.every((c, i) => c.pinNumber === b.parts[i].pinNumber)
  );
}

/** ポートの名前が同じか */
function sameLabels(a: CircuitDef, b: CircuitDef): boolean {
  return a.parts.every((c, i) => c.label === b.parts[i].label);
}
