import { type PartLayoutOf, squareLayout } from '../layout';

/** 小さな四角の配置の、本体を円にしたもの */
export const output: PartLayoutOf = (pinout) => ({ ...squareLayout(pinout), body: 'circle' });
