import { describe, expect, it } from 'vitest';
import { frameTicks, MAX_TICKS_PER_FRAME } from './frameTicks';

describe('frameTicks', () => {
  it('経過時間ぶんの tick を進め、端数は次のフレームへ持ち越す', () => {
    expect(frameTicks(25, 10)).toEqual({ count: 2, carry: 5 });
  });

  it('1 tick に満たなければ進めず、そのまま持ち越す', () => {
    expect(frameTicks(7, 10)).toEqual({ count: 0, carry: 7 });
  });

  it('持ち越した端数は、次のフレームの経過時間と合わせて数える', () => {
    const first = frameTicks(16, 10);
    expect(first).toEqual({ count: 1, carry: 6 });
    expect(frameTicks(first.carry + 16, 10)).toEqual({ count: 2, carry: 2 });
  });

  it('上限ちょうどなら、打ち切らずに全部進める', () => {
    expect(frameTicks(MAX_TICKS_PER_FRAME * 10 + 3, 10)).toEqual({
      count: MAX_TICKS_PER_FRAME,
      carry: 3,
    });
  });

  it('上限を超えた遅れは取り戻さず、端数だけを持ち越す', () => {
    // タブを 1 分離れていたときなど
    const r = frameTicks(60_000 + 4, 10);
    expect(r).toEqual({ count: MAX_TICKS_PER_FRAME, carry: 4 });
    // 次のフレームは、ふだんの経過時間ぶんだけ進む
    expect(frameTicks(r.carry + 16, 10)).toEqual({ count: 2, carry: 0 });
  });
});
