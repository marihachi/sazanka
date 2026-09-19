import andIcon from './assets/icons/and.svg';
import clockIcon from './assets/icons/clock.svg';
import dffIcon from './assets/icons/dff.svg';
import inputIcon from './assets/icons/input.svg';
import jkffIcon from './assets/icons/jkff.svg';
import moduleIcon from './assets/icons/module.svg';
import nandIcon from './assets/icons/nand.svg';
import norIcon from './assets/icons/nor.svg';
import notIcon from './assets/icons/not.svg';
import orIcon from './assets/icons/or.svg';
import outputIcon from './assets/icons/output.svg';
import srIcon from './assets/icons/sr.svg';
import tffIcon from './assets/icons/tff.svg';
import xorIcon from './assets/icons/xor.svg';
import type { Kind } from './sim';

const ICONS: Partial<Record<Kind, string>> = {
  INPUT: inputIcon,
  CLOCK: clockIcon,
  OUTPUT: outputIcon,
  AND: andIcon,
  OR: orIcon,
  NOT: notIcon,
  NAND: nandIcon,
  NOR: norIcon,
  XOR: xorIcon,
  SR: srIcon,
  DFF: dffIcon,
  TFF: tffIcon,
  JKFF: jkffIcon,
  CUSTOM: moduleIcon,
};

/**
 * 部品の種類ごとのアイコン (32×24)。
 * SVG をマスクとして使い、文字色 (currentColor) で塗る。
 */
export function PartIcon({ kind }: { kind: Kind }) {
  const url = ICONS[kind] ?? moduleIcon;
  const mask = `url("${url}") center / contain no-repeat`;
  return <span className="part-icon" aria-hidden="true" style={{ mask, WebkitMask: mask }} />;
}
