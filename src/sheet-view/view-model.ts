import { GameLoop, getPointer, init, initPointer, pointerPressed, Sprite } from 'kontra';
import { CellIndex, CellPoint } from '../sheet/cell.js';
import { GateEntity, SheetEntity, WireEntity } from '../sheet/entity.js';
import { Sheet } from '../sheet/sheet.js';
import { WireDirection } from '../sheet/wire-direction.js';

const cellViewSize = 12;

// TODO: add toolbar (none, gate, wire, erase)

export class SheetView {
  loop?: GameLoop;
  session?: {
    sheet: Sheet,
    backSprite: Sprite,
    gridRows: Sprite[],
    gridColumns: Sprite[],
    entitySprites: Map<SheetEntity, Sprite>,
    tool: 'none' | 'erase' | 'gate' | 'wire',
  };

  init() {
    const { canvas } = init();
    initPointer();

    this.newSession(48, 48);

    if (this.session != null) {
      this.session.tool = 'gate';
    }

    // const debugText = Text({
    //   text: '',
    //   color: 'white',
    // });

    let prevPressed = pointerPressed('left');

    const view = this;

    this.loop = GameLoop({
      //blur: true,
      fps: 60,
      update() {
        if (view.session != null) {
          const pointer = getPointer();
          const pointerX = Math.floor(pointer.x);
          const pointerY = Math.floor(pointer.y);
          const pressed = pointerPressed('left');

          const cell = view.getCellPoint(pointerX, pointerY);

          if (view.session.tool == 'gate' && prevPressed != pressed) {
            prevPressed = pressed;
            if (cell.x >= 0 && cell.y >= 0 && pressed) {
              view.addGate(cell);
            }
          }

          if (view.session.tool == 'wire') {
            prevPressed = pressed;
            if (cell.x >= 0 && cell.y >= 0 && pressed) {
              view.addWire(cell);
            }
          }

          if (view.session.tool == 'erase') {
            prevPressed = pressed;
            if (cell.x >= 0 && cell.y >= 0 && pressed) {
              view.removeEntity(cell);
            }
          }

          view.session.backSprite.update();
          view.session.entitySprites.forEach(x => x.update());

          view.session.gridRows.forEach(x => x.update());
          view.session.gridColumns.forEach(x => x.update());

          // debugText.text = `pointer: ${pointerX} ${pointerY}, cell: ${cell.x} ${cell.y}`;
          // debugText.update();
        }
      },
      render() {
        if (view.session != null) {
          view.session.backSprite.render();

          view.session.gridRows.forEach(x => x.render());
          view.session.gridColumns.forEach(x => x.render());

          view.session.entitySprites.forEach(x => x.render());

          // debugText.render();
        }
      },
    });
    this.loop.start();
  }

  newSession(width: number, height: number) {
    const sheet = new Sheet(width, height);

    const backSprite = Sprite({
      x: 0,
      y: 0,
      width: sheet.width * cellViewSize,
      height: sheet.height * cellViewSize,
      color: '#181818',
    });

    const gridRows: Sprite[] = [];
    for (let i = 0; i < Math.floor(height); i++) {
      gridRows.push(Sprite({
        x: 0,
        y: (i + 1) * cellViewSize - 1,
        width: sheet.width * cellViewSize,
        height: 1,
        color: '#2E2E2E',
      }));
    }

    const gridColumns: Sprite[] = [];
    for (let i = 0; i < Math.floor(width); i++) {
      gridColumns.push(Sprite({
        x: (i + 1) * cellViewSize - 1,
        y: 0,
        width: 1,
        height: sheet.height * cellViewSize,
        color: '#2E2E2E',
      }));
    }

    this.session = {
      sheet: sheet,
      backSprite: backSprite,
      gridRows: gridRows,
      gridColumns: gridColumns,
      entitySprites: new Map(),
      tool: 'none',
    };
  }

  getCellPoint(x: number, y: number) {
    if (this.session == null) {
      throw new Error('sheet is not opened.');
    }

    return new CellPoint(Math.floor(x / cellViewSize), Math.floor(y / cellViewSize), this.session.sheet);
  }

  private addGateSprite(point: CellPoint, entity: GateEntity) {
    if (this.session == null) {
      throw new Error('sheet is not opened.');
    }
    const width = entity.width * cellViewSize - 1;
    const height = entity.height * cellViewSize - 1;
    const sprite = Sprite({
      x: point.x * cellViewSize,
      y: point.y * cellViewSize,
      width: width,
      height: height,
      render() {
        if (this.context == null) {
          return;
        }
        const ctx = this.context;
        ctx.beginPath();
        ctx.lineCap = 'square';

        // draw gate
        ctx.rect(0, 0, width, height);
        ctx.fillStyle = '#1c1c1c';
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.stroke();

        // draw name (center top)
        ctx.font = '16px consolas';
        const nameMetrics = ctx.measureText(entity.name);
        ctx.fillStyle = '#AAA';
        ctx.fillText(entity.name, width / 2 - nameMetrics.width / 2, 18);
      },
    });
    this.session.entitySprites.set(entity, sprite);
  }

  addGate(cell: CellPoint) {
    if (this.session == null) {
      throw new Error('sheet is not opened.');
    }

    if (cell.sheet != this.session.sheet) {
      throw new Error('other sheet specified.');
    }

    const cellIndex = CellIndex.fromPointValue(cell.x, cell.y, this.session.sheet);

    if (cell.sheet.entities.has(cellIndex.value)) {
      throw new Error('entity already exists.');
    }

    // TODO: check conflict other entities.

    // add entity
    const entity = new GateEntity('AND', 5, 5, 2, 1);
    this.session.sheet.entities.set(cellIndex.value, entity);

    // add sprite
    this.addGateSprite(cell, entity);
  }

  private addWireSprite(point: CellPoint, entity: WireEntity) {
    if (this.session == null) {
      throw new Error('sheet is not opened.');
    }
    const half = cellViewSize / 2;
    const sprite = Sprite({
      x: point.x * cellViewSize,
      y: point.y * cellViewSize,
      width: cellViewSize,
      height: cellViewSize,
      render() {
        if (this.context == null) {
          return;
        }
        const ctx = this.context;
        ctx.beginPath();
        ctx.lineCap = 'square';
        if (entity.dir.hasTop()) {
          ctx.moveTo(half, half);
          ctx.lineTo(half, 0);
        }
        if (entity.dir.hasLeft()) {
          ctx.moveTo(half, half);
          ctx.lineTo(0, half);
        }
        if (entity.dir.hasBottom()) {
          ctx.moveTo(half, half);
          ctx.lineTo(half, cellViewSize);
        }
        if (entity.dir.hasRight()) {
          ctx.moveTo(half, half);
          ctx.lineTo(cellViewSize, half);
        }
        ctx.strokeStyle = '#999';
        ctx.stroke();
      },
    });
    this.session.entitySprites.set(entity, sprite);
  }

  addWire(cell: CellPoint) {
    if (this.session == null) {
      throw new Error('sheet is not opened.');
    }

    if (cell.sheet != this.session.sheet) {
      throw new Error('other sheet specified.');
    }

    const cellIndex = CellIndex.fromPointValue(cell.x, cell.y, this.session.sheet);

    if (this.session.sheet.entities.has(cellIndex.value)) {
      throw new Error('entity already exists.');
    }

    // TODO: check conflict other entities.

    // add entity
    const wireDir = new WireDirection();
    wireDir.setLeft();
    wireDir.setRight();
    const entity = new WireEntity(wireDir);
    this.session.sheet.entities.set(cellIndex.value, entity);

    // add sprite
    this.addWireSprite(cell, entity);
  }

  removeEntity(cell: CellPoint) {
    if (this.session == null) {
      throw new Error('sheet is not opened.');
    }

    if (cell.sheet != this.session.sheet) {
      throw new Error('other sheet specified.');
    }

    const cellIndex = CellIndex.fromPointValue(cell.x, cell.y, this.session.sheet);

    if (!this.session.sheet.entities.has(cellIndex.value)) {
      throw new Error('entity not exists.');
    }

    // TODO: check entity area

    const entity = this.session.sheet.entities.get(cellIndex.value)!;

    // remove entity
    this.session.sheet.entities.delete(cellIndex.value);

    // remove sprite
    this.session.entitySprites.delete(entity);
  }

  dispose() {
    this.loop?.stop();
  }
}
