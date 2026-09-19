import logo from '../assets/logo.svg';
import { MaskIcon } from './Icons';
import './Header.css';

/** 最上部のヘッダー (ロゴ) */
export function Header() {
  return (
    <header className="header">
      <h1>
        <MaskIcon src={logo} className="logo" />
        <span className="visually-hidden">sazanka</span>
      </h1>
    </header>
  );
}
