import { Sprite } from 'kontra';
import { CellIndex, CellPoint } from '../sheet/cell.js';
import { GateEntity, SheetEntity, WireEntity } from '../sheet/entity.js';
import { Sheet } from '../sheet/sheet.js';
import { WireDirection } from '../sheet/wire-direction.js';

export const cellViewSize = 12;

export class SheetViewModel {
  session?: {
    sheet: Sheet,
    backSprite: Sprite,
    gridRows: Sprite[],
    gridColumns: Sprite[],
    entitySprites: Map<SheetEntity, Sprite>,
    tool: 'hand' | 'gate' | 'wire',
  };

  newSession(width: number, height: number) {
    // create sheet
    const sheet = new Sheet(width, height);

    // sheet back sprite
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
      tool: 'hand',
    };
  }

  getCellPoint(x: number, y: number) {
    if (this.session == null) {
      throw new Error('sheet is not opened.');
    }

    return new CellPoint(Math.floor(x / cellViewSize), Math.floor(y / cellViewSize), this.session.sheet);
  }

  private createGateSprite(point: CellPoint, entity: GateEntity): Sprite {
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
    return sprite;
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
      // entity already exists
      return;
    }

    // TODO: check conflict other entities.

    // add entity
    const entity = new GateEntity('AND', 5, 5, 2, 1);
    this.session.sheet.entities.set(cellIndex.value, entity);

    // add sprite
    const sprite = this.createGateSprite(cell, entity);
    this.session.entitySprites.set(entity, sprite);
  }

  private createWireSprite(point: CellPoint, entity: WireEntity): Sprite {
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
    return sprite;
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
      // entity already exists
      return;
    }

    // TODO: check conflict other entities.

    // add entity
    const wireDir = new WireDirection();
    wireDir.setLeft();
    wireDir.setRight();
    const entity = new WireEntity(wireDir);
    this.session.sheet.entities.set(cellIndex.value, entity);

    // add sprite
    const sprite = this.createWireSprite(cell, entity);
    this.session.entitySprites.set(entity, sprite);
  }
}
