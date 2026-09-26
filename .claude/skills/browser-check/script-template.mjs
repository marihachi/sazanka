// 使い捨ての確認スクリプトの雛形。作業用のフォルダにコピーして使う（リポジトリには置かない）。
// 事前に作業用フォルダで `npm i puppeteer-core` し、その環境にあるブラウザの実行ファイルを指定する。
import puppeteer from 'puppeteer-core';

const URL = 'http://localhost:5199/';
const EXECUTABLE_PATH = process.env.BROWSER_PATH; // 環境にあるブラウザのパス

// 確認用の回路。座標はシートの表示範囲の真ん中あたりに置く。
const project = {
  version: 1,
  project: {
    circuits: [
      {
        id: 'main',
        name: 'メイン回路',
        components: [
          { id: 'part-1', kind: 'INPUT', x: 2400, y: 1900 },
          { id: 'part-2', kind: 'AND', x: 2560, y: 1900 },
          { id: 'part-3', kind: 'OUTPUT', x: 2720, y: 1900 },
        ],
        wires: [
          {
            id: 'wire-1',
            from: { comp: 'part-1', pin: 0 },
            to: { comp: 'part-2', pin: 0 },
            points: [],
          },
          {
            id: 'wire-2',
            from: { comp: 'part-2', pin: 0 },
            to: { comp: 'part-3', pin: 0 },
            points: [],
          },
        ],
      },
    ],
  },
};

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

// 1回目の読み込みが終わるのを待ってから localStorage に書く（待たないと自動保存に上書きされる）。
await page.goto(URL, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 500));
await page.evaluate((data) => {
  localStorage.setItem('sazanka.project', JSON.stringify(data));
}, project);
await page.reload({ waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 500));

// ここに確かめたい操作と読み取りを書く。
// クラス名はハッシュが付くので部分一致で探す。
const wireCount = await page.evaluate(
  () =>
    [...document.querySelectorAll('[class]')].filter(
      (el) => /wire/.test(el.className) && !/wire-hit/.test(el.className),
    ).length,
);
console.log('配線の数:', wireCount);

await page.screenshot({ path: 'check.png' });

if (errors.length > 0) {
  console.log(`エラー:\n${errors.join('\n')}`);
} else {
  console.log('エラーなし');
}

await browser.close();
