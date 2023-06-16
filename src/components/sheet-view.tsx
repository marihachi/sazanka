import { useEffect } from 'react';
import { init, GameLoop } from 'kontra';
import { createBackground, createGate, createWire } from '../model/sprite.js';
import { BOTTOM, calcCellId, calcPos, createSheet, GATE, LEFT, RIGHT, TOP, WIRE } from '../model/sheet.js';
import './sheet-view.css';

function SheetView() {
  useEffect(() => {
    const { canvas } = init();

    // create sheet
    const sheetWidth = 32;
    const sheetHeight = 32;
    const sheet = createSheet(sheetWidth, sheetHeight);

    // create entities
    sheet.entities.set(calcCellId({ x: 2, y: 2 }, sheetWidth), GATE('AND', 5, 5, 2, 1));

    // create sprites
    const back = createBackground(canvas.width, canvas.height);
    for (const [i, entity] of sheet.entities) {
      if (entity.kind == 'gate') {
        entity.sprite = createGate(calcPos(i, sheetWidth), entity);
      }
      if (entity.kind == 'wire') {
        entity.sprite = createWire(calcPos(i, sheetWidth), entity);
      }
    }

    // loop
    let loop = GameLoop({
      update() {
        back.update();
        sheet.entities.forEach(x => x.sprite?.update());
      },
      render() {
        back.render();
        sheet.entities.forEach(x => x.sprite?.render());
      }
    });
    loop.start();
  });

  return (
    <>
      <canvas
        width={1280}
        height={720}
      />
    </>
  );
}

export default SheetView;
