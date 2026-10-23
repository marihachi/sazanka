// 手元のファイルへの保存と、ファイルを選ぶ画面で選んだファイルの読み込み

/** 書き出すプロジェクトファイルの名前。日付は端末の時刻で、例: project-2026-10-11.sazanka.json */
export function getExportFileName(date: Date): string {
  return `project-${dateStamp(date)}.sazanka.json`;
}

/** ファイル名に入れる日付 (端末の時刻)。例: 2026-10-11 */
export function dateStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 保存先のファイル (File System Access API の FileSystemFileHandle のうち、使うところ) */
interface SaveFileHandle {
  /** 利用者が選んだファイルの名前 */
  name: string;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
}

/**
 * 保存場所とファイル名を選ぶ画面 (showSaveFilePicker)。Chromium のブラウザ (Chrome、Edge など) にだけあり、
 * 安全な接続 (https か localhost) でしか使えない。TypeScript の型 (lib.dom) にないので、ここで形を書く
 */
type SaveFilePicker = (options: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<SaveFileHandle>;

/**
 * 押したボタンからフォーカスを外す。ブラウザの保存の画面やファイルを選ぶ画面を開く前に呼ぶ。
 * その画面を閉じると、ブラウザはウィンドウと押したボタンにフォーカスを戻す。そのとき結果を知らせるダイアログが開いていると、
 * ダイアログの外へフォーカスが移ったとみなされて、ダイアログが閉じてしまう (毎回ではなく、タイミングで決まる)。戻す先をなくしておく
 */
function releaseFocus() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

/**
 * Electron で作ったアプリの中のブラウザか (ユーザーエージェントに `Electron/` を含む)。VS Code の中のブラウザなど。
 * これらは showSaveFilePicker を持ち、保存の画面も開けるが、選んだファイルへの書き込み (createWritable) を断る。
 * 断られてからダウンロードに切り替えると、ダウンロードでも保存先を聞くので、保存の画面が 2 回出てしまう。
 * そのため初めから保存の画面を使わず、ダウンロードで保存する
 */
function isElectron(): boolean {
  return /\bElectron\//.test(navigator.userAgent);
}

/**
 * 文字列を JSON ファイルとして保存する。保存したら、保存したファイルの名前、利用者が保存の画面で取り消したら undefined。
 * showSaveFilePicker が使えるブラウザでは、保存場所とファイル名を選ぶ画面を出す。
 * 使えないブラウザ (Firefox、Safari)、Electron の中のブラウザ (isElectron) と、あっても画面を開けない・書き込めない環境では、a 要素の download で保存する (保存場所を聞くかはブラウザの設定による。
 * 取り消したかも、利用者が付けた名前もアプリから分からないので、保存を始めたら name を返す)。
 * 保存の画面では、利用者が選んだ名前を返す
 */
export async function saveJsonFile(name: string, text: string): Promise<string | undefined> {
  const picker = isElectron()
    ? undefined
    : (window as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  if (picker) {
    releaseFocus();
    try {
      const handle = await picker({
        suggestedName: name,
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return handle.name;
    } catch (e) {
      // 保存の画面で取り消した
      if (e instanceof DOMException && e.name === 'AbortError') {
        return undefined;
      }
      // showSaveFilePicker はあるのに、保存の画面を開けない、または選んだファイルに書き込めない環境がある
      // (VS Code の中のブラウザでは、画面は開けるが createWritable が NotAllowedError になる)。下のダウンロードで保存する
      console.warn('保存の画面からは保存できなかったので、ダウンロードで保存します', e);
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  // click の直後に URL を消すと、保存が始まる前に消えて失敗するブラウザがある (Safari など)。
  // 少し待ってから消す
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return name;
}

/**
 * ファイルを選ぶ画面を開き、選んだファイルを返す。取り消したら undefined。
 * 押した操作の中で呼ぶ (ブラウザは、利用者の操作の中でしか、ファイルを選ぶ画面を開かせない)。
 * 取り消したことを知らせる cancel イベントがないブラウザでは、取り消すと結果が返らないままになる (何もしないのと同じ)
 */
export function pickFile(accept: string): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    // 画面には出さない。ページに置かないとファイルを選ぶ画面を開けないブラウザがあるので、置いてから開く
    input.style.display = 'none';
    const done = (file: File | undefined) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => done(input.files?.[0]));
    input.addEventListener('cancel', () => done(undefined));
    document.body.append(input);
    releaseFocus();
    input.click();
  });
}

/** 選んだファイルを文字列として読む。読めなければ例外を投げる (選んだあとにファイルが消されたときなど) */
export function readTextFile(file: File): Promise<string> {
  // UTF-8 として読む。先頭の BOM (メモ帳などが付ける) は File.text() が外す
  return file.text();
}
