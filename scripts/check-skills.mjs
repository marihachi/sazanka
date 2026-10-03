// .agents/skills/ と .claude/skills/ が同じ内容かを確かめる。違いがあれば失敗が挙がる。
// Skill は .agents/skills/ を編集して .claude/skills/ へ写す決まり (docs/agent/skills.md)。写し忘れや、片方だけの編集に気付くためのもの。
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// どこから実行しても同じに動くよう、パスはこのファイルの場所から決める
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = '.agents/skills';
const copy = '.claude/skills';

/** フォルダの中の全ファイルを、フォルダからの相対パス (区切りは /) で返す。 */
function listFiles(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      join(entry.parentPath, entry.name)
        .slice(dir.length + 1)
        .replaceAll('\\', '/'),
    );
}

const sourceDir = join(root, source);
const copyDir = join(root, copy);
const sourceFiles = new Set(listFiles(sourceDir));
const copyFiles = new Set(listFiles(copyDir));
const problems = [];

for (const file of [...new Set([...sourceFiles, ...copyFiles])].sort()) {
  if (!copyFiles.has(file)) {
    problems.push(`${source}/${file} にしかない`);
  } else if (!sourceFiles.has(file)) {
    problems.push(`${copy}/${file} にしかない`);
  } else if (!readFileSync(join(sourceDir, file)).equals(readFileSync(join(copyDir, file)))) {
    problems.push(`${file} の中身が違う`);
  }
}

if (problems.length > 0) {
  console.error(`${source}/ と ${copy}/ が食い違っている:`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  console.error(
    `${source}/ を編集して ${copy}/ へ写す。片方で上書きせず、差分を見て 1 つにまとめる (docs/agent/skills.md)。`,
  );
  process.exit(1);
}
console.log(`${source}/ と ${copy}/ は同じ`);
