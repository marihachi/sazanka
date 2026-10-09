import { Button, Dialog as ChakraDialog, Text } from '@chakra-ui/react';
import { useRef } from 'react';
import { useMessages } from '../i18n/useMessages';
import { DialogFrame } from './DialogFrame';

export interface ConfirmRequest {
  message: string;
  /** 確定ボタンの文言。onConfirm がなければ「OK」だけのお知らせになる */
  confirmLabel?: string;
  /** 確定すると取り返しのつかない操作か (ボタンを赤くする) */
  danger?: boolean;
  onConfirm?: () => void;
}

/** 画面内のモーダルダイアログ (確認とお知らせ) */
export function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest;
  onClose: () => void;
}) {
  const m = useMessages();
  const confirmRef = useRef<HTMLButtonElement>(null);

  return (
    <DialogFrame
      onClose={onClose}
      initialFocus={confirmRef}
      role={request.onConfirm ? 'alertdialog' : 'dialog'}
    >
      <ChakraDialog.Body pt="6">
        <Text>{request.message}</Text>
      </ChakraDialog.Body>
      <ChakraDialog.Footer>
        {request.onConfirm && (
          <Button variant="outline" onClick={onClose}>
            {m.common.cancel}
          </Button>
        )}
        <Button
          ref={confirmRef}
          colorPalette={request.danger ? 'red' : undefined}
          onClick={() => {
            onClose();
            request.onConfirm?.();
          }}
        >
          {request.onConfirm ? (request.confirmLabel ?? m.common.ok) : m.common.ok}
        </Button>
      </ChakraDialog.Footer>
    </DialogFrame>
  );
}
