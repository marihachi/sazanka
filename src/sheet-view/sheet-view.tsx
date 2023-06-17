import { useEffect } from 'react';
import { init, GameLoop, Sprite } from 'kontra';
import './sheet-view.css';
import { Sheet } from '../sheet/sheet.js';
import { CellIndex, CellPoint } from '../sheet/cell.js';
import { createBackground, createGate, createWire } from './sprite.js';
import { WireDirection } from '../sheet/wire-direction.js';
import { GateEntity, isGateEntity, isWireEntity, SheetEntity, WireEntity } from '../sheet/entity';

function SheetView() {
  useEffect(() => {
    const { canvas } = init();

    // create sheet
    const sheet = new Sheet(32, 32);

    // create test gate
    const testGateCell = CellIndex.fromPointValue(12, 2, sheet).value;
    sheet.entities.set(testGateCell, new GateEntity('AND', 5, 5, 2, 1));

    // create test wires
    let testWireCell = 0;

    testWireCell = CellIndex.fromPointValue(17, 4, sheet).value;
    const testWireDir = new WireDirection();
    testWireDir.setLeft();
    testWireDir.setRight();
    sheet.entities.set(testWireCell, new WireEntity(testWireDir));

    testWireCell = CellIndex.fromPointValue(18, 4, sheet).value;
    testWireDir.clear();
    testWireDir.setLeft();
    testWireDir.setBottom();
    sheet.entities.set(testWireCell, new WireEntity(testWireDir));

    testWireCell = CellIndex.fromPointValue(18, 5, sheet).value;
    testWireDir.clear();
    testWireDir.setTop();
    testWireDir.setBottom();
    sheet.entities.set(testWireCell, new WireEntity(testWireDir));

    // setup sprites
    const sprites: Map<SheetEntity, Sprite> = new Map();
    const back = createBackground(canvas.width, canvas.height);
    for (const [i, entity] of sheet.entities) {
      const p = CellPoint.fromIndexValue(i, sheet);
      if (isGateEntity(entity)) {
        const sprite = createGate(p, entity);
        sprites.set(entity, sprite);
      }
      if (isWireEntity(entity)) {
        const sprite = createWire(p, entity);
        sprites.set(entity, sprite);
      }
    }

    // loop
    let loop = GameLoop({
      update() {
        back.update();
        sprites.forEach(x => x.update());
      },
      render() {
        back.render();
        sprites.forEach(x => x.render());
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
