import { describe, expect, it } from 'vitest';
import { wirePath } from './wirePath';

describe('wirePath', () => {
  const from = { x: 0, y: 0 };
  const to = { x: 100, y: 60 };

  it('角を丸めなければ、通る点を直線でつなぐ', () => {
    expect(wirePath(from, [], to, false)).toBe('M0,0 L60,0 L60,60 L100,60');
  });

  it('角を丸めるなら、角の手前から曲線でつなぐ', () => {
    expect(wirePath(from, [], to, true)).toBe(
      'M0,0 L54,0 Q60,0 60,6 L60,54 Q60,60 66,60 L100,60',
    );
  });

  it('短い区間では、半径を区間の長さの半分までに抑える', () => {
    expect(wirePath(from, [], { x: 100, y: 4 }, true)).toBe(
      'M0,0 L58,0 Q60,0 60,2 L60,2 Q60,4 62,4 L100,4',
    );
  });
});
