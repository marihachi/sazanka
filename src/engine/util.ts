// このアプリのどの責務にも属さない、汎用的な小さな関数

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
