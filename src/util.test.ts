import { describe, expect, it } from 'vitest';
import { isObject, mustGet, shallowEqual } from './util';

describe('isObject', () => {
  it('ふつうのオブジェクトだけを認める', () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ a: 1 })).toBe(true);
  });

  it('配列、null、オブジェクトでない値は認めない', () => {
    for (const v of [[], null, undefined, 1, 'a', true]) {
      expect(isObject(v)).toBe(false);
    }
  });
});

describe('mustGet', () => {
  it('あるキーの値を返す', () => {
    expect(mustGet(new Map([['a', 1]]), 'a')).toBe(1);
  });

  it('キーがなければ、キーを含めた例外にする', () => {
    expect(() => mustGet(new Map<string, number>(), 'x')).toThrow('x');
  });

  it('値が falsy でも、あれば返す', () => {
    expect(mustGet(new Map([['a', 0]]), 'a')).toBe(0);
    expect(mustGet(new Map([['a', false]]), 'a')).toBe(false);
  });
});

describe('shallowEqual', () => {
  it('中身が 1 段目まで === で同じなら同じとみなす', () => {
    const f = () => {};
    expect(shallowEqual({ a: 1, b: f }, { a: 1, b: f })).toBe(true);
  });

  it('値が違うか、キーの数が違えば違う', () => {
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(shallowEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  it('2 段目は中身ではなく参照で比べる', () => {
    expect(shallowEqual({ a: { x: 1 } }, { a: { x: 1 } })).toBe(false);
  });

  it('どちらも undefined なら同じ、片方だけなら違う', () => {
    expect(shallowEqual(undefined, undefined)).toBe(true);
    expect(shallowEqual({}, undefined)).toBe(false);
    expect(shallowEqual(undefined, {})).toBe(false);
  });
});
