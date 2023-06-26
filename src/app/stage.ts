import * as PIXI from '../pixi.js';
import { SheetEditor } from './ui/sheet-editor.js';

export function initStage() {
  const app = new PIXI.Application({
    resizeTo: window,
    backgroundColor: 0x181818,
    antialias: true,
  });
  document.body.appendChild(app.view as any);

  // add editor
  const editor = new SheetEditor(app.screen.width, app.screen.height, app.ticker);
  app.stage.addChild(editor.container);
  editor.init();
  app.ticker.add(() => {
    editor.width = app.screen.width;
    editor.height = app.screen.height;
  });
};
