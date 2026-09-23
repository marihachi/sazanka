// Claude Code の PostToolUse フック: エージェントが編集したファイルを Biome で整形する。
// 標準入力でフックの入力 (JSON) を受け取る。整形できないファイルや失敗は無視し、エージェントの作業は止めない。
import { spawnSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// npx を通さず、プロジェクトに入っている Biome を直接動かす (起動が速く、OS によるシェルの違いも受けない)
const biome = join(root, 'node_modules/@biomejs/biome/bin/biome');

let input = '';
for await (const chunk of process.stdin) {
  input += chunk;
}

try {
  const { tool_input: toolInput } = JSON.parse(input);
  const file = toolInput?.file_path && resolve(toolInput.file_path);
  // プロジェクトの外のファイルは対象外
  if (!file || relative(root, file).startsWith('..')) {
    process.exit(0);
  }

  // 対象外のファイル (Markdown や .gitignore にあるもの) は、エラーにせず何もしない
  const result = spawnSync(
    process.execPath,
    [biome, 'format', '--write', '--no-errors-on-unmatched', file],
    { cwd: root, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    // 編集途中で構文が壊れている場合など。整形せずに終わる
    const message = (result.stderr || result.stdout || '').trim().split('\n');
    console.error(`biome: ${message[0] ?? result.error?.message ?? ''}`);
  }
} catch (e) {
  console.error(`biome: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
}
