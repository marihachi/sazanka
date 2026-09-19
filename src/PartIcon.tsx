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
import rsIcon from './assets/icons/rs.svg';
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
  RS: rsIcon,
  DFF: dffIcon,
  TFF: tffIcon,
  JKFF: jkffIcon,
  CUSTOM: moduleIcon,
};

/** SVG をマスクとして使い、文字色 (currentColor) で塗るアイコン。大きさは className で指定する */
export function MaskIcon({ src, className }: { src: string; className: string }) {
  const mask = `url("${src}") center / contain no-repeat`;
  return <span className={className} aria-hidden="true" style={{ mask, WebkitMask: mask }} />;
}

/** 部品の種類ごとのアイコン (32×24) */
export function PartIcon({ kind }: { kind: Kind }) {
  return <MaskIcon src={ICONS[kind] ?? moduleIcon} className="part-icon" />;
}
