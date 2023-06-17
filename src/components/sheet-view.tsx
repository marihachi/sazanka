import { useEffect } from 'react';
import { init, GameLoop } from 'kontra';
import './sheet-view.css';
import { Sheet } from '../model/sheet.js';
import { CellIndex } from '../model/cell';
import { createBackground, createGate, createWire } from '../model/sprite';
import { GATE, WIRE } from '../model/entity';
import { Point } from '../model/point';
import { DirectionSet } from '../model/direction';

function SheetView() {
  useEffect(() => {
    const { canvas } = init();

    // create sheet
    const sheet = new Sheet(32, 32);

    // create test gate
    const testGateCell = CellIndex.fromPointValue(2, 2, sheet).value;
    sheet.entities.set(testGateCell, GATE('AND', 5, 5, 2, 1));

    // create test wires
    let testWireCell = 0;

    testWireCell = CellIndex.fromPointValue(7, 4, sheet).value;
    const testWireDir = new DirectionSet();
    testWireDir.setLeft();
    testWireDir.setRight();
    sheet.entities.set(testWireCell, WIRE(testWireDir));

    testWireCell = CellIndex.fromPointValue(8, 4, sheet).value;
    testWireDir.clear();
    testWireDir.setLeft();
    testWireDir.setBottom();
    sheet.entities.set(testWireCell, WIRE(testWireDir));

    testWireCell = CellIndex.fromPointValue(8, 5, sheet).value;
    testWireDir.clear();
    testWireDir.setTop();
    testWireDir.setBottom();
    sheet.entities.set(testWireCell, WIRE(testWireDir));

    // setup sprites
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
