// 1 フレームで進める tick 数の決め方。フレームの間隔と tick の間隔は別なので、経過時間から数える

/** 1 フレームで進める tick 数の上限。重いときや、タブを離れていた間の遅れを一気に取り戻さないため */
export const MAX_TICKS_PER_FRAME = 20;

/**
 * このフレームで進める tick 数と、次のフレームへ持ち越す時間 (ms)。
 * carry は前のフレームから持ち越した時間に、このフレームまでの経過時間を足したもの。
 * 上限で打ち切ったときは、遅れは取り戻さずに捨てる (シミュレーションの時間が遅れる)。
 * 持ち越すのは 1 tick に満たない端数だけ
 */
export function frameTicks(carry: number, interval: number): { count: number; carry: number } {
  const due = Math.floor(carry / interval);
  // どちらの分岐でも、持ち越すのは 1 tick に満たない端数 (carry % interval と carry - due * interval は同じ値)。
  // 上限で打ち切るときは、上限を超えた分の tick (due - MAX_TICKS_PER_FRAME) を持ち越さずに捨てる
  if (due > MAX_TICKS_PER_FRAME) {
    return { count: MAX_TICKS_PER_FRAME, carry: carry % interval };
  }
  return { count: due, carry: carry - due * interval };
}
