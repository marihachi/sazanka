import * as PIXI from '../pixi.js';
import { Editor } from './ui/editor.js';

export function initStage() {
  const app = new PIXI.Application({
    resizeTo: window,
    backgroundColor: 0x181818,
    antialias: true,
  });
  document.body.appendChild(app.view as any);
  // debug
  // (globalThis as any).__PIXI_APP__ = app;

  // add editor
  const editor = new Editor(app.screen.width, app.screen.height, app.ticker);
  app.stage.addChild(editor.container);
  editor.init();
  app.ticker.add(() => {
    editor.width = app.screen.width;
    editor.height = app.screen.height;
  });

  // debug text
  const debugText = new PIXI.Text('', new PIXI.TextStyle({ fontSize: 14, fill: '#ffffff' }));
  app.stage.eventMode = 'dynamic';
  app.stage.hitArea = app.screen;
  app.stage.addEventListener('pointermove', (e) => {
    debugText.text = `${e.global.x} ${e.global.y}`;
  });
  app.stage.addChild(debugText);
};
