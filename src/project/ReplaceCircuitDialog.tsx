import { Box, Button, Checkbox, Dialog as ChakraDialog, Stack, Text } from '@chakra-ui/react';
import { useRef, useState } from 'react';
import type { CircuitDef } from '../circuit/project';
import { getCircuitName } from '../i18n/messages';
import { useMessages } from '../i18n/useMessages';
import { DialogFrame } from '../ui/DialogFrame';

export interface ReplaceCircuitRequest {
  /** 差し替える回路の表示名 */
  name: string;
  /** 差し替え先にできる回路 (replace.ts の replaceTargets) */
  targets: CircuitDef[];
  /** 差し替え先 id と、ピン (パッケージ、ピンの数と番号) が違うか */
  pinsDiffer: (id: string) => boolean;
  onSubmit: (targetId: string, removeSource: boolean) => void;
}

/**
 * 別のモジュールに差し替えるダイアログ (行のメニューの「別のモジュールに差し替える…」)。
 * 差し替え先を選ぶと、元の回路を置いている部品が、すべて差し替え先を指すようになる。
 * ピンが違えば、配線が外れたり別のピンにつながったりすることを、差し替える前に知らせる。
 * 差し替えたあと、元の回路をプロジェクトから削除するかを選べる
 */
export function ReplaceCircuitDialog({
  request,
  onClose,
}: {
  request: ReplaceCircuitRequest;
  onClose: () => void;
}) {
  const m = useMessages();
  const [target, setTarget] = useState<string | undefined>(undefined);
  const [removeSource, setRemoveSource] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <DialogFrame
      onClose={onClose}
      initialFocus={cancelRef}
      onSubmit={(e) => {
        e.preventDefault();
        if (target === undefined) {
          return;
        }
        onClose();
        request.onSubmit(target, removeSource);
      }}
    >
      <ChakraDialog.Header>
        <ChakraDialog.Title>{m.replace.title(request.name)}</ChakraDialog.Title>
      </ChakraDialog.Header>
      <ChakraDialog.Body>
        <Stack gap="3">
          <Text textStyle="sm" fontWeight="medium">
            {m.replace.target}
          </Text>
          {request.targets.length === 0 ? (
            <Text textStyle="sm" color="fg.muted">
              {m.replace.none}
            </Text>
          ) : (
            <Box
              as="ul"
              role="listbox"
              borderWidth="1px"
              rounded="l2"
              maxH="48"
              overflowY="auto"
              py="1"
            >
              {request.targets.map((d) => (
                <Box
                  as="li"
                  key={d.id}
                  role="option"
                  aria-selected={target === d.id}
                  tabIndex={0}
                  listStyleType="none"
                  px="3"
                  py="1"
                  textStyle="sm"
                  cursor="pointer"
                  userSelect="none"
                  bg={target === d.id ? 'bg.emphasized' : undefined}
                  _hover={{ bg: target === d.id ? 'bg.emphasized' : 'bg.muted' }}
                  onClick={() => setTarget(d.id)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setTarget(d.id);
                    }
                  }}
                >
                  {/* フォルダに入っていれば、フォルダのパスも添える (同じ名前の回路を見分けるため) */}
                  <Text as="span">{getCircuitName(d, m)}</Text>
                  {d.path && (
                    <Text as="span" color="fg.muted" ms="2">
                      {d.path}
                    </Text>
                  )}
                </Box>
              ))}
            </Box>
          )}
          {target !== undefined && request.pinsDiffer(target) && (
            <Text textStyle="sm" color="fg.warning">
              {m.replace.pinsDiffer}
            </Text>
          )}
          <Checkbox.Root
            checked={removeSource}
            onCheckedChange={(e) => setRemoveSource(e.checked === true)}
            size="sm"
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control />
            <Checkbox.Label>{m.replace.removeSource(request.name)}</Checkbox.Label>
          </Checkbox.Root>
        </Stack>
      </ChakraDialog.Body>
      <ChakraDialog.Footer>
        <Button ref={cancelRef} variant="outline" onClick={onClose}>
          {m.common.cancel}
        </Button>
        <Button type="submit" disabled={target === undefined}>
          {m.replace.apply}
        </Button>
      </ChakraDialog.Footer>
    </DialogFrame>
  );
}
