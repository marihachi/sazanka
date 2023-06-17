import { useEffect } from 'react';
import { init, GameLoop } from 'kontra';
import './sheet-view.css';
import { Sheet } from '../model/sheet.js';
import { CellIndex } from '../model/cell';
import { createBackground, createGate, createWire } from '../model/sprite';
import { GATE } from '../model/entity';
import { Point } from '../model/point';

function SheetView() {
  useEffect(() => {
    const { canvas } = init();

    // create sheet
    const sheet = new Sheet(32, 32);

    // create entities
    const testCellIndex = CellIndex.fromPointValue(2, 2, sheet).value;
    sheet.entities.set(testCellIndex, GATE('AND', 5, 5, 2, 1));

    // create sprites
    const back = createBackground(canvas.width, canvas.height);
    for (const [i, entity] of sheet.entities) {
      const p = Point.fromCellIndexValue(i, sheet);
      if (entity.kind == 'gate') {
        entity.sprite = createGate(p, entity);
      }
      if (entity.kind == 'wire') {
        entity.sprite = createWire(p, entity);
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
