// このアプリのどの責務にも属さない、汎用的な小さな関数

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * あるはずのキーの値を取り出す。
 * なければ不変条件が壊れているので、後で分かりにくいエラーになる前に、その場で例外にする
 */
export function mustGet<K, V>(map: Map<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`あるはずのキーがありません: ${String(key)}`);
  }
  return value;
}

/**
 * `Set<T>`の要素の型Tを取り出す
 */
export type SetElement<T> = T extends Set<infer U> ? U : never;

/**
 * 2 つのオブジェクトの中身を 1 段だけ比べる (値は === で比べる)。どちらも undefined なら同じとみなす
 */
export function shallowEqual(a: object | undefined, b: object | undefined): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  const ka = Object.keys(a) as (keyof typeof a)[];
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
}
