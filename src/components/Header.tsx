import infoIcon from '../assets/icons/info.svg';
import logo from '../assets/logo.svg';
import { MaskIcon } from './Icons';
import styles from './Header.module.css';

/** 最上部のヘッダー (ロゴと、このアプリについて) */
export function Header({ onAbout }: { onAbout: () => void }) {
  return (
    <header className={styles.header}>
      <h1>
        <MaskIcon src={logo} className={styles.logo} />
        <span className="visually-hidden">sazanka</span>
      </h1>
      <button className={styles.about} onClick={onAbout} title="このアプリについて" aria-label="このアプリについて">
        <MaskIcon src={infoIcon} className={styles.aboutIcon} />
      </button>
    </header>
  );
}
