import * as PIXI from 'pixi.js';

export class EditorToolbar {
  container: PIXI.Container;
  width: number;
  height: number;
  private ticker: PIXI.Ticker;

  constructor(width: number, height: number, ticker: PIXI.Ticker) {
    this.container = new PIXI.Container();
    this.width = width;
    this.height = height;
    this.ticker = ticker;
  }

  init() {
    // TODO
  }
}
