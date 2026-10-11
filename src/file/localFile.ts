// 手元のファイルへの保存 (ブラウザのダウンロードの仕組みを使う)

/** 書き出すファイルの名前。日付は端末の時刻で、例: sazanka-2026-10-11.json */
export function getExportFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `sazanka-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

/**
 * 文字列を JSON ファイルとして保存させる。
 * showSaveFilePicker は Chromium でしか動かないので、どのブラウザでも動く a 要素の download を使う
 */
export function saveJsonFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  // click の直後に URL を消すと、保存が始まる前に消えて失敗するブラウザがある (Safari など)。
  // 少し待ってから消す
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
