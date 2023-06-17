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
  useEffect(() => {
    registerEvents();

    // initialize kontra
    const { canvas } = init();
    initPointer();

    const viewModel = new SheetViewModel();
    viewModel.newSession(64, 64);

    const debugText = Text({
      text: '',
      color: 'white',
    });

    // create view loop
    let loop = GameLoop({
      blur: true,
      update() {
        if (viewModel.session != null) {
          const pointer = getPointer();
          const pressed = pointerPressed('left');

          const cell = viewModel.getCellPoint(pointer.x, pointer.y);

          // if pointer pressed
          if (cell.x >= 0 && cell.y >= 0 && pressed) {
            viewModel.addGate(cell);
            // sheetViewModel.addWire(cell);
          }

          viewModel.session.backSprite.update();
          viewModel.session.entitySprites.forEach(x => x.update());

          // debug
          debugText.text = `pointer: ${pointer.x} ${pointer.y}, cell: ${cell.x} ${cell.y}`;
          debugText.update();
        }
      },
      render() {
        if (viewModel.session != null) {
          viewModel.session.backSprite.render();
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
      <canvas
        id='sheet-view'
        width={1280}
        height={720}
      />
    </>
  );
}

export default SheetView;
