import { type PartLayoutOf, terminalLayout } from '../layout';

/** 本体を円にした端子 */
export const output: PartLayoutOf = (pinout) => ({ ...terminalLayout(pinout), body: 'circle' });
