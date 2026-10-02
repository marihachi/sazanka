import {
  Button,
  Dialog as ChakraDialog,
  Link,
  Stack,
  Text,
  VisuallyHidden,
} from '@chakra-ui/react';
import { useRef } from 'react';
import logo from '../../assets/logo.svg';
import { MaskIcon } from '../../ui/Icons';
import { DialogFrame } from '../../ui/DialogFrame';

/** このアプリについての画面内ダイアログ */
export function AboutDialog({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  return (
    <DialogFrame onClose={onClose} initialFocus={closeRef}>
      <ChakraDialog.Header justifyContent="center" pt="8">
        <ChakraDialog.Title display="flex">
          <MaskIcon src={logo} w="153px" h="42px" bg="brand" />
          <VisuallyHidden>sazanka について</VisuallyHidden>
        </ChakraDialog.Title>
      </ChakraDialog.Header>
      <ChakraDialog.Body>
        <Stack gap="4" align="center" textAlign="center">
          <Text>ブラウザで動く論理回路シミュレータです。</Text>
          <Stack as="ul" gap="1" listStyleType="none">
            <li>
              <Link
                href="https://github.com/marihachi/sazanka"
                target="_blank"
                rel="noreferrer noopener"
                colorPalette="accent"
                variant="underline"
              >
                GitHub リポジトリ
              </Link>
            </li>
            <li>
              {/* 同梱しているライブラリのライセンス文。MIT などは配布物に含めることが条件なので、必ず置く (ビルドで書き出す) */}
              <Link
                href={`${import.meta.env.BASE_URL}licenses.txt`}
                target="_blank"
                rel="noreferrer noopener"
                colorPalette="accent"
                variant="underline"
              >
                使用しているライブラリのライセンス
              </Link>
            </li>
          </Stack>
          <Text textStyle="xs" color="fg.muted">
            MIT ライセンスで利用できます。ロゴには Inter SemiBold (SIL OFL)
            というフォントを使っています。
          </Text>
        </Stack>
      </ChakraDialog.Body>
      <ChakraDialog.Footer>
        <Button ref={closeRef} onClick={onClose}>
          閉じる
        </Button>
      </ChakraDialog.Footer>
    </DialogFrame>
  );
}
