// 使い捨ての確認スクリプトの雛形。作業用のフォルダにコピーして使う（リポジトリには置かない）。
// 事前に作業用フォルダで `npm i puppeteer-core` し、その環境にあるブラウザの実行ファイルを指定する。
// URL、保存データのキーと形は、`browser-check.md` (AGENTS.md の一覧から辿る) を見て埋める。
import puppeteer from 'puppeteer-core';

const URL = ''; // 開く URL
const EXECUTABLE_PATH = process.env.BROWSER_PATH; // 環境にあるブラウザのパス

const STORAGE_KEY = ''; // 状態を用意するときに書く、保存データのキー
const STORAGE_DATA = {}; // 保存データの中身 (形はドキュメントを見る)

const browser = await puppeteer.launch({
  executablePath: EXECUTABLE_PATH,
  headless: true,
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

const errors = [];
page.on('pageerror', (e) => errors.push(`例外: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') {
    errors.push(`コンソール: ${m.text()}`);
  }
});
page.on('requestfailed', (r) => errors.push(`通信失敗: ${r.url()}`));
page.on('response', (r) => {
  if (r.status() >= 400) {
    errors.push(`${r.status()}: ${r.url()}`);
  }
});

// 人の操作をまねる関数。値の決め方は SKILL.md の「人の操作をまねる」。
// 確認によって使わないものもあるので、export して未使用の指摘を避けている。
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** 要素の真ん中の座標 */
async function centerOf(el) {
  const box = await el.boundingBox();
  if (!box) {
    throw new Error('要素が見えていません (画面の外か、表示されていない)');
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** ポインターを載せる。ツールチップを見るときは、そのあと 700ms ほど待つ */
export async function hover(el) {
  const { x, y } = await centerOf(el);
  await page.mouse.move(x, y, { steps: 8 });
  await wait(100);
}

/** クリックして、次の操作まで間をあける */
export async function click(el) {
  await hover(el);
  await page.mouse.down();
  await wait(60);
  await page.mouse.up();
  await wait(250);
}

/** ダブルクリック。1 回目と 2 回目の間を 100ms あける */
export async function doubleClick(el) {
  await hover(el);
  await page.mouse.down();
  await wait(60);
  await page.mouse.up();
  await wait(100);
  await page.mouse.down({ clickCount: 2 });
  await wait(60);
  await page.mouse.up({ clickCount: 2 });
  await wait(250);
}

/** from から to の座標へドラッグする。1 歩 8px ほどを、1 フレームずつ待ちながら動かす */
export async function drag(from, to) {
  await page.mouse.move(from.x, from.y, { steps: 8 });
  await page.mouse.down();
  await wait(100);
  const steps = Math.max(10, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 8));
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * i) / steps,
      from.y + ((to.y - from.y) * i) / steps,
    );
    await wait(16);
  }
  await wait(100);
  await page.mouse.up();
  await wait(250);
}

/** 文字を 1 文字ずつ入力する */
export async function type(text) {
  await page.keyboard.type(text, { delay: 50 });
  await wait(250);
}

// 1回目の読み込みが終わるのを待ってから localStorage に書く（待たないと自動保存に上書きされる）。
await page.goto(URL, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 500));
await page.evaluate(
  (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
  },
  STORAGE_KEY,
  STORAGE_DATA,
);
await page.reload({ waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 500));

// ここに確かめたい操作と読み取りを書く。操作は上の click / doubleClick / drag / type / hover で行う。
// 要素は、役割の属性 (role、aria-label など) で探すと、クラス名の変化に左右されにくい。
// 例:
//   await click(await page.$('button[aria-label="保存"]'));
//   console.log('ダイアログの数:', await page.$$eval('[role="dialog"]', (d) => d.length));

await page.screenshot({ path: 'check.png' });

if (errors.length > 0) {
  console.log(`エラー:\n${errors.join('\n')}`);
} else {
  console.log('エラーなし');
}

await browser.close();
