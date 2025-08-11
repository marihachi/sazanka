import * as PIXI from '../../pixi.js';
import { SheetEntity } from '../entity/entity.js';
import { GateEntity } from '../entity/gate.js';
import { WireDirection, WireEntity } from '../entity/wire.js';
import { Sheet } from '../sheet.js';

const cellSize = 12;

export function calcCellPosition(point: [number, number]): [number, number] {
  return [Math.floor(point[0] / cellSize), Math.floor(point[1] / cellSize)];
}

export class SheetView {
  container: PIXI.Container;
  width: number;
  height: number;
  private ticker: PIXI.Ticker;
  tool: 'none' | 'erase' | 'gate' | 'wire' = 'none';
  private sheet: Sheet;
  private objectTable: Map<SheetEntity, PIXI.DisplayObject>;
  private objectsLayer: PIXI.Container;
  private gridLayer: PIXI.Graphics;

  constructor(width: number, height: number, ticker: PIXI.Ticker) {
    this.container = new PIXI.Container();
    this.width = width;
    this.height = height;
    this.ticker = ticker;
    this.sheet = new Sheet();
    this.objectTable = new Map();
    this.objectsLayer = new PIXI.Container();
    this.gridLayer = new PIXI.Graphics();
  }

  init() {
    this.container.addChild(this.gridLayer);
    this.container.addChild(this.objectsLayer);

    let offset = [0, 0];
    this.ticker.add(() => {
      this.objectsLayer.x = offset[0];
      this.objectsLayer.y = offset[1];

      for (const [entity, object] of this.objectTable) {
        // get the local position of the object to the view container.
        const pos = this.container.toLocal(object.getGlobalPosition());

        // culling
        const boundLeft = -(entity.width * cellSize);
        const boundTop = -(entity.height * cellSize);
        const boundRight = this.width;
        const boundBottom = this.height;
        object.renderable = (pos.x >= boundLeft && pos.y >= boundTop && pos.x <= boundRight && pos.y <= boundBottom);
      }
    });

    // grid tick
    this.ticker.add(() => {
      this.gridLayer.clear();

      let x = offset[0] % cellSize;
      while (this.width - x >= 0) {
        if (x >= 0) {
          this.gridLayer
            .lineStyle(1, 0x2e2e2e, 1, 0)
            .moveTo(x, 0)
            .lineTo(x, this.height);
        }
        x += cellSize;
      }

      let y = offset[1] % cellSize;
      while (this.height - y >= 0) {
        if (y >= 0) {
          this.gridLayer
            .lineStyle(1, 0x2e2e2e, 1, 0)
            .moveTo(0, y)
            .lineTo(this.width, y);
        }
        y += cellSize;
      }
    });
  }

  addGate(sheetPos: [number, number]) {
    // TODO: check conflict other entities.

    const entity = new GateEntity('AND', 5, 5, 2, 1);
    const object = new PIXI.Container();
    object.x = sheetPos[0] * cellSize;
    object.y = sheetPos[1] * cellSize;

    const graphics = new PIXI.Graphics();

    graphics
      .beginFill(0x1c1c1c)
      .drawRect(0, 0, cellSize * 5, cellSize * 5)
      .endFill();

    graphics
      .lineStyle(2, 0x444444, 1, 0)
      .drawRect(0, 0, cellSize * 5, cellSize * 5);

    object.eventMode = 'static';
    object.cursor = 'pointer';

    const area = new PIXI.Rectangle(0, 0, cellSize * 5, cellSize * 5);
    object.hitArea = area;

    object.on('click', () => {
      console.log(sheetPos, entity);
    });

    object.addChild(graphics);

    const nameText = new PIXI.Text();
    nameText.text = entity.name;
    nameText.style = new PIXI.TextStyle({ fontFamily: 'Arial', fontSize: 12, fill: '#aaaaaa' });

    nameText.x = cellSize * 2.5;
    nameText.y = cellSize * 1.25;
    nameText.anchor.set(0.5);

    object.addChild(nameText);

    this.sheet.setEntity(sheetPos, entity);
    this.objectTable.set(entity, object);
    this.objectsLayer.addChild(object);
  }

  addWire(sheetPos: [number, number]) {
    // TODO: check conflict other entities.
    // TODO: decide direction

    const direction = new WireDirection();

    direction
      .setLeft()
      .setRight();

    const entity = new WireEntity(direction);

    const object = new PIXI.Graphics();
    object.x = sheetPos[0] * cellSize;
    object.y = sheetPos[1] * cellSize;

    object
      .lineStyle(2, 0x666666, 1, 0)
      .moveTo(0, cellSize / 2)
      .lineTo(cellSize, cellSize / 2);

    object.eventMode = 'static';
    object.cursor = 'pointer';

    const area = new PIXI.Rectangle(0, 0, cellSize, cellSize);
    object.hitArea = area;

    object.on('click', () => {
      console.log(sheetPos, entity);
    });

    this.sheet.setEntity(sheetPos, entity);
    this.objectTable.set(entity, object);
    this.objectsLayer.addChild(object);
  }

  removeViewEntity(sheetPos: [number, number]) {
    const entity = this.sheet.getEntity(sheetPos);
    if (entity == null) {
      return;
    }

    const graphics = this.objectTable.get(entity);
    if (graphics == null) {
      return;
    }

    this.objectsLayer.removeChild(graphics);
    this.objectTable.delete(entity);
    this.sheet.deleteEntity(sheetPos);
  }
}
