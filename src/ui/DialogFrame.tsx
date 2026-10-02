import { Dialog as ChakraDialog, Portal } from '@chakra-ui/react';

// ブラウザの prompt / confirm / alert は VS Code 内のブラウザなどで動かないため、画面内の UI で代替する

/**
 * ダイアログの外枠 (Chakra の Dialog)。Esc と外側のクリックで閉じ、開いている間はフォーカスを中に閉じ込める。
 * 開くかどうかは呼び出し側が、このコンポーネントを置くかどうかで決める
 */
export function DialogFrame({
  onClose,
  initialFocus,
  role = 'dialog',
  size = 'sm',
  onSubmit,
  children,
}: {
  onClose: () => void;
  /** 開いたときにフォーカスする要素 */
  initialFocus: React.RefObject<HTMLElement | null>;
  role?: 'dialog' | 'alertdialog';
  size?: 'sm' | 'md';
  /** 渡すと中身を form にして、Enter で送信できるようにする */
  onSubmit?: (e: React.FormEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <ChakraDialog.Root
      open
      onOpenChange={(e) => {
        if (!e.open) {
          onClose();
        }
      }}
      role={role}
      size={size}
      placement="center"
      initialFocusEl={() => initialFocus.current}
    >
      <Portal>
        <ChakraDialog.Backdrop />
        <ChakraDialog.Positioner>
          {onSubmit ? (
            <ChakraDialog.Content asChild>
              <form onSubmit={onSubmit}>{children}</form>
            </ChakraDialog.Content>
          ) : (
            <ChakraDialog.Content>{children}</ChakraDialog.Content>
          )}
        </ChakraDialog.Positioner>
      </Portal>
    </ChakraDialog.Root>
  );
}
