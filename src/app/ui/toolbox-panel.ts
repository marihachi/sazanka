import * as PIXI from '../../pixi.js';

export class ToolboxPanel {
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

    const panelFrame = new PIXI.Graphics();
    this.container.addChild(panelFrame);

    const title = new PIXI.Text('Tool Box', new PIXI.TextStyle({ fontFamily: 'Consolas', fontSize: 14, fill: '#fff' }));
    title.x = 8;
    title.y = 8;
    this.container.addChild(title);

    this.ticker.add(() => {
      panelFrame.clear();

      panelFrame
        .lineStyle(1, 0x444444, 1, 0)
        .drawRect(0, 0, this.width, this.height);
    });
  }
}
