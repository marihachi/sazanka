import * as PIXI from '../../pixi.js';
import { Toolbar } from './toolbar.js';
import { SheetView } from './sheet-view.js';
import { ToolboxPanel } from './toolbox-panel.js';

const toolbarHeight = 30;
const sidePanelWidth = 200;

export class Editor {
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
    // sheet view
    const view = new SheetView(this.width - sidePanelWidth, this.height - toolbarHeight, this.ticker);
    view.container.x = sidePanelWidth;
    view.container.y = toolbarHeight;
    this.container.addChild(view.container);
    view.init();
    this.ticker.add(() => {
      view.width = this.width;
      view.height = this.height - toolbarHeight;
    });

    // toolbar
    const toolbar = new Toolbar(this.width, toolbarHeight, this.ticker);
    this.container.addChild(toolbar.container);
    toolbar.init();
    this.ticker.add(() => {
      toolbar.width = this.width;
      toolbar.height = toolbarHeight;
    });

    // toolbox panel
    const toolbox = new ToolboxPanel(sidePanelWidth, this.height - toolbarHeight, this.ticker);
    toolbox.container.x = 0;
    toolbox.container.y = toolbarHeight;
    this.container.addChild(toolbox.container);
    toolbox.init();
    this.ticker.add(() => {
      toolbox.width = sidePanelWidth;
      toolbox.height = this.height - toolbarHeight;
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
