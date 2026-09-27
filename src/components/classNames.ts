/** 条件付きのクラス名をつなげる。偽の値は除く */
export function classNames(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
