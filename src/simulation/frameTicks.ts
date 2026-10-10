// 1 フレームで進める tick 数の決め方。フレームの間隔と tick の速さは別なので、経過時間から数える。
// 計算が間に合わないときの打ち切り (FRAME_BUDGET_MS) は、時間を進めるループ (useSimulation.ts) が行う

/**
 * 1 フレームで tick の計算に使う時間の上限 (ms)。超えたら、そのフレームの残りの tick は進めず、遅れは取り戻さない。
 * 60 fps の 1 フレーム (約 16.7ms) の半分ほどにして、残りを描画に回す。
 * tick 数ではなく時間で決めるので、画面のリフレッシュレートや回路の重さによらず、fps が落ちすぎない
 */
export const FRAME_BUDGET_MS = 8;

/**
 * 1 フレームで数える経過時間の上限 (ms)。タブを離れていた間 (フレームが来ない) や、とても重いフレームのあとに、
 * その間の tick を一度に進めないため。超えた時間は数えない (シミュレーションの時間が実時間より遅れる)。
 * 5 fps (1 フレーム 200ms) を下回ると遅れ始める
 */
export const MAX_FRAME_ELAPSED_MS = 200;

/**
 * このフレームで進める tick 数と、次のフレームへ持ち越す 1 tick に満たない端数 (tick)。
 * carry は前のフレームから持ち越した端数、elapsed は前のフレームからの経過時間 (ms。MAX_FRAME_ELAPSED_MS まで数える)。
 * 例: 100 tick/秒で 16.7ms 経てば 1.67 tick なので、1 tick 進めて 0.67 を持ち越す
 */
export function frameTicks(
  carry: number,
  elapsed: number,
  ticksPerSecond: number,
): { count: number; carry: number } {
  const due = carry + (Math.min(elapsed, MAX_FRAME_ELAPSED_MS) * ticksPerSecond) / 1000;
  const count = Math.floor(due);
  return { count, carry: due - count };
}
