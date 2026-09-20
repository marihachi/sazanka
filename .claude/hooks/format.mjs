// Claude Code の PostToolUse フック: エージェントが編集したファイルを Prettier で整形する。
// 標準入力でフックの入力 (JSON) を受け取る。整形できないファイルや失敗は無視し、エージェントの作業は止めない。
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

let input = '';
for await (const chunk of process.stdin) input += chunk;

try {
  const { tool_input: toolInput } = JSON.parse(input);
  const file = toolInput?.file_path && resolve(toolInput.file_path);
  // プロジェクトの外のファイルは対象外
  if (!file || relative(root, file).startsWith('..')) process.exit(0);

  const info = await prettier.getFileInfo(file, {
    ignorePath: [join(root, '.prettierignore'), join(root, '.gitignore')],
    resolveConfig: true,
  });
  if (info.ignored || !info.inferredParser) process.exit(0);

  const source = readFileSync(file, 'utf8');
  const options = await prettier.resolveConfig(file);
  const formatted = await prettier.format(source, { ...options, filepath: file });
  if (formatted !== source) writeFileSync(file, formatted);
} catch (e) {
  // 編集途中で構文が壊れている場合など。整形せずに終わる
  console.error(`prettier: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
}
