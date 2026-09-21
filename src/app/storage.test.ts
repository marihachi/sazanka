import { describe, expect, it } from 'vitest';
import { emptyProject } from '../engine/project';
import { readStored } from './storage';

const project = emptyProject();

describe('readStored', () => {
  it('保存データがなければ空のプロジェクト', () => {
    expect(readStored(null)).toEqual({ project: emptyProject() });
  });

  it('版付きの保存データを読み込む', () => {
    expect(readStored(JSON.stringify({ version: 1, project }))).toEqual({ project });
  });

  it('INPUT / CLOCK の ON/OFF は読み込まない (古いデータには入っている)', () => {
    const withSwitch = {
      circuits: [
        { id: 'main', name: 'メイン', components: [{ id: 'a', kind: 'INPUT', x: 20, y: 0, on: true }], wires: [] },
      ],
    };
    const result = readStored(JSON.stringify({ version: 1, project: withSwitch }));
    expect(result.error).toBeUndefined();
    expect(result.project.circuits[0].components[0].on).toBeUndefined();
  });

  it('新しい版のデータは読み込まず、理由を返す', () => {
    const result = readStored(JSON.stringify({ version: 99, project }));
    expect(result.project).toEqual(emptyProject());
    expect(result.error).toContain('新しい版');
  });

  it('壊れたデータは読み込まず、理由を返す', () => {
    // 版のない保存データ (以前の形式) も読み込まない
    for (const raw of [
      '{',
      JSON.stringify(project),
      '{"version":1}',
      JSON.stringify({ version: 1, project: { circuits: [] } }),
    ]) {
      const result = readStored(raw);
      expect(result.project).toEqual(emptyProject());
      expect(result.error).toContain('壊れていた');
    }
  });
});
