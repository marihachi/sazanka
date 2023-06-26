import * as PIXI from '../../pixi.js';
import { EditorToolbar } from './editor-toolbar.js';
import { EditorView } from './editor-view.js';

const toolbarHeight = 30;

export class SheetEditor {
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
    // editor view
    const view = new EditorView(this.width, this.height - toolbarHeight, this.ticker);
    view.container.y = toolbarHeight;
    this.container.addChild(view.container);
    view.init();
    this.ticker.add(() => {
      view.width = this.width;
      view.height = this.height - toolbarHeight;
    });

    // toolbar
    const toolbar = new EditorToolbar(this.width, toolbarHeight, this.ticker);
    this.container.addChild(toolbar.container);
    toolbar.init();
    this.ticker.add(() => {
      toolbar.width = this.width;
      toolbar.height = toolbarHeight;
    });

    // add test items
    view.addGate([4, 1]);
    view.addWire([3, 2]);
    view.addWire([3, 4]);
    view.addWire([9, 3]);
    view.addGate([4, 10]);
    view.removeViewEntity([4, 10]);
  }
}
