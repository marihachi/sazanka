// 部品の種類ごとのアイコン
import { MaskIcon } from '../ui/Icons';
import { module } from './module/view';
import { partViewOf } from './views';

/** 部品の種類ごとのアイコン (32×24)。見せ方のない種類 (BUF) は、モジュールのアイコンで代える */
export function PartIcon({ kind }: { kind: string }) {
  return <MaskIcon src={partViewOf(kind)?.icon ?? module.icon} w="8" h="6" />;
}
