import logo from '../assets/logo.svg';
import { MaskIcon } from './Icons';
import styles from './Header.module.css';

/** 最上部のヘッダー (ロゴ) */
export function Header() {
  return (
    <header className={styles.header}>
      <h1>
        <MaskIcon src={logo} className={styles.logo} />
        <span className="visually-hidden">sazanka</span>
      </h1>
    </header>
  );
}
