import { useRef } from 'react';

/**
 * 渡した関数を、描き直しても同じ関数 (呼ぶと最新の描画の中身を実行する) にして返す。
 * 子の部品は React.memo で、props が変わらなければ描き直さないので、関数を渡すたびに作り直すと効かなくなる。
 * useCallback と違い、関数が使う状態を依存に並べなくてよく、古い値を見てしまうこともない
 */
export function useStableCallbacks<T extends Record<string, (...args: never[]) => unknown>>(
  fns: T,
): T {
  const latest = useRef(fns);
  latest.current = fns;
  const stable = useRef<T | null>(null);
  if (!stable.current) {
    stable.current = Object.fromEntries(
      Object.keys(fns).map((key) => [key, (...args: never[]) => latest.current[key](...args)]),
    ) as T;
  }
  return stable.current;
}
