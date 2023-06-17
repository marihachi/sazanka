import { useEffect } from 'react';
import { init, GameLoop, initPointer, getPointer, pointerPressed, Text } from 'kontra';
import './sheet-view.css';
import { SheetViewModel } from './view-model.js';

function contextmenuHandler(e: MouseEvent) {
  e.preventDefault();
}

function registerEvents() {
  document.querySelector<HTMLCanvasElement>('#sheet-view')?.addEventListener(`contextmenu`, contextmenuHandler);
}

function unregisterEvents() {
  document.querySelector<HTMLCanvasElement>('#sheet-view')?.removeEventListener('contextmenu', contextmenuHandler);
}

function SheetView() {
  const viewModel = new SheetViewModel();

  function changeTool(name: 'hand' | 'erase' | 'gate' | 'wire') {
    if (viewModel.session == null) {
      return;
    }
    viewModel.session.tool = name;
  }

  useEffect(() => {
    registerEvents();

    // initialize kontra
    const { canvas } = init();
    initPointer();

    viewModel.newSession(48, 48);

    const debugText = Text({
      text: '',
      color: 'white',
    });

    let prevPressed = pointerPressed('left');

    // create view loop
    let loop = GameLoop({
      blur: true,
      fps: 60,
      update() {
        if (viewModel.session != null) {
          const pointer = getPointer();
          const pointerX = Math.floor(pointer.x);
          const pointerY = Math.floor(pointer.y);
          const pressed = pointerPressed('left');

          const cell = viewModel.getCellPoint(pointerX, pointerY);

          if (viewModel.session.tool == 'gate' && prevPressed != pressed) {
            prevPressed = pressed;
            if (cell.x >= 0 && cell.y >= 0 && pressed) {
              viewModel.addGate(cell);
            }
          }

          if (viewModel.session.tool == 'wire') {
            prevPressed = pressed;
            if (cell.x >= 0 && cell.y >= 0 && pressed) {
              viewModel.addWire(cell);
            }
          }

          if (viewModel.session.tool == 'erase') {
            prevPressed = pressed;
            if (cell.x >= 0 && cell.y >= 0 && pressed) {
              viewModel.removeEntity(cell);
            }
          }

          viewModel.session.backSprite.update();
          viewModel.session.entitySprites.forEach(x => x.update());

          viewModel.session.gridRows.forEach(x => x.update());
          viewModel.session.gridColumns.forEach(x => x.update());

          // debug
          debugText.text = `pointer: ${pointerX} ${pointerY}, cell: ${cell.x} ${cell.y}`;
          debugText.update();
        }
      },
      render() {
        if (viewModel.session != null) {
          viewModel.session.backSprite.render();

          viewModel.session.gridRows.forEach(x => x.render());
          viewModel.session.gridColumns.forEach(x => x.render());

          viewModel.session.entitySprites.forEach(x => x.render());

          // debug
          debugText.render();
        }
      },
    });
    loop.start();

    // dispose
    return () => {
      unregisterEvents();
    };
  });

  return (
    <>
      <button onClick={() => changeTool('hand')}>Hand</button>
      <button onClick={() => changeTool('erase')}>Erase</button>
      <button onClick={() => changeTool('gate')}>Gate</button>
      <button onClick={() => changeTool('wire')}>Wire</button>
      <canvas
        id='sheet-view'
        width={1280}
        height={720}
      />
    </>
  );
}

export default SheetView;
