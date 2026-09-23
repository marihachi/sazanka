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
