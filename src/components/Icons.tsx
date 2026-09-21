import type { ComponentKind } from '../engine/component';
import andIcon from '../assets/icons/and.svg';
import clockIcon from '../assets/icons/clock.svg';
import dffIcon from '../assets/icons/dff.svg';
import highIcon from '../assets/icons/high.svg';
import inputIcon from '../assets/icons/input.svg';
import jkffIcon from '../assets/icons/jkff.svg';
import moduleIcon from '../assets/icons/module.svg';
import nandIcon from '../assets/icons/nand.svg';
import norIcon from '../assets/icons/nor.svg';
import notIcon from '../assets/icons/not.svg';
import orIcon from '../assets/icons/or.svg';
import outputIcon from '../assets/icons/output.svg';
import rsIcon from '../assets/icons/rs.svg';
import tffIcon from '../assets/icons/tff.svg';
import xorIcon from '../assets/icons/xor.svg';
import styles from './Icons.module.css';

const ICONS: Partial<Record<ComponentKind, string>> = {
  INPUT: inputIcon,
  CLOCK: clockIcon,
  HIGH: highIcon,
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

/** ツールバーなどのボタンに付けるアイコン (16×16) */
export function ToolIcon({ src }: { src: string }) {
  return <MaskIcon src={src} className={styles.toolIcon} />;
}

/** 部品の種類ごとのアイコン (32×24) */
export function PartIcon({ kind }: { kind: ComponentKind }) {
  return <MaskIcon src={ICONS[kind] ?? moduleIcon} className={styles.partIcon} />;
}
