import fitIcon from '../assets/icons/fit.svg';
import minusIcon from '../assets/icons/minus.svg';
import plusIcon from '../assets/icons/plus.svg';
import { ToolIcon } from './Icons';
import styles from './ZoomControls.module.css';

interface ZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** 等倍に戻す */
  onReset: () => void;
  /** 回路全体が収まるように表示する */
  onFit: () => void;
}

/** シートの右下に重ねて置く、拡大縮小のボタン */
export function ZoomControls({ scale, onZoomIn, onZoomOut, onReset, onFit }: ZoomControlsProps) {
  return (
    // ボタンを押したときに、シートの範囲選択などが始まらないようにする
    <div className={styles.zoom} onPointerDown={(e) => e.stopPropagation()}>
      <button className={styles.button} onClick={onZoomOut} title="縮小" aria-label="縮小">
        <ToolIcon src={minusIcon} />
      </button>
      <button className={styles.percent} onClick={onReset} title="等倍に戻す">
        {Math.round(scale * 100)}%
      </button>
      <button className={styles.button} onClick={onZoomIn} title="拡大" aria-label="拡大">
        <ToolIcon src={plusIcon} />
      </button>
      <button className={styles.button} onClick={onFit} title="回路全体を表示" aria-label="回路全体を表示">
        <ToolIcon src={fitIcon} />
      </button>
    </div>
  );
}
