import { type PartLayoutOf, terminalLayout } from '../layout';

/** 本体を円にした端子 */
export const output: PartLayoutOf = (pins) => ({ ...terminalLayout(pins), body: 'circle' });
