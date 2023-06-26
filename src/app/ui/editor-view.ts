import * as PIXI from '../../pixi.js';
import { SheetEntity } from '../entity/entity.js';
import { GateEntity } from '../entity/gate.js';
import { WireDirection, WireEntity } from '../entity/wire.js';
import { Sheet } from '../sheet.js';

const cellSize = 12;

export function calcCellPosition(point: [number, number]): [number, number] {
  return [Math.floor(point[0] / cellSize), Math.floor(point[1] / cellSize)];
}

export class EditorView {
  container: PIXI.Container;
  width: number;
  height: number;
  private ticker: PIXI.Ticker;
  tool: 'none' | 'erase' | 'gate' | 'wire' = 'none';
  private sheet: Sheet;
  private objectTable: Map<SheetEntity, PIXI.DisplayObject>;
  private gridGraphics: PIXI.Graphics;

  constructor(width: number, height: number, ticker: PIXI.Ticker) {
    this.container = new PIXI.Container();
    this.width = width;
    this.height = height;
    this.ticker = ticker;
    this.sheet = new Sheet();
    this.objectTable = new Map();
    this.gridGraphics = new PIXI.Graphics();
  }

  init() {
    this.container.addChild(this.gridGraphics);

    // grid tick
    this.ticker.add(() => {
      this.gridGraphics.clear();

      let x = 0;
      while (this.width - x > 0) {
        this.gridGraphics
          .lineStyle(1, 0x2e2e2e, 1, 0)
          .moveTo(x, 0)
          .lineTo(x, this.height);
        x += cellSize;
      }
  
      let y = 0;
      while (this.height - y > 0) {
        this.gridGraphics
          .lineStyle(1, 0x2e2e2e, 1, 0)
          .moveTo(0, y)
          .lineTo(this.width, y);
        y += cellSize;
      }
    });
  }

  addGate(sheetPos: [number, number]) {
    // TODO: check conflict other entities.

    const entity = new GateEntity('AND', 5, 5, 2, 1);
    const object = new PIXI.Container();

    const graphics = new PIXI.Graphics();
    graphics.x = sheetPos[0] * cellSize;
    graphics.y = sheetPos[1] * cellSize;

    graphics
      .beginFill(0x1c1c1c)
      .drawRect(0, 0, cellSize * 5, cellSize * 5)
      .endFill();

    graphics
      .lineStyle(2, 0x444444, 1, 0)
      .drawRect(0, 0, cellSize * 5, cellSize * 5);

    graphics.eventMode = 'static';
    graphics.cursor = 'pointer';

    const area = new PIXI.Rectangle(0, 0, cellSize * 5, cellSize * 5);
    graphics.hitArea = area;

    graphics.on('click', () => {
      console.log(sheetPos, entity);
    });

    object.addChild(graphics);

    const nameText = new PIXI.Text();
    nameText.text = entity.name;
    nameText.style = new PIXI.TextStyle({ fontFamily: 'Arial', fontSize: 12, fill: '#aaaaaa' });

    nameText.x = sheetPos[0] * cellSize + cellSize * 2.5;
    nameText.y = sheetPos[1] * cellSize + cellSize * 1.25;
    nameText.anchor.set(0.5);

    object.addChild(nameText);

    this.sheet.setEntity(sheetPos, entity);
    this.objectTable.set(entity, object);
    this.container.addChild(object);
  }

  addWire(sheetPos: [number, number]) {
    // TODO: check conflict other entities.
    // TODO: decide direction

    const direction = new WireDirection();

    direction
      .setLeft()
      .setRight();

    const entity = new WireEntity(direction);

    const graphics = new PIXI.Graphics();
    graphics.x = sheetPos[0] * cellSize;
    graphics.y = sheetPos[1] * cellSize;

    graphics
      .lineStyle(2, 0x666666, 1, 0)
      .moveTo(0, cellSize / 2)
      .lineTo(cellSize, cellSize / 2);

    graphics.eventMode = 'static';
    graphics.cursor = 'pointer';

    const area = new PIXI.Rectangle(0, 0, cellSize, cellSize);
    graphics.hitArea = area;

    graphics.on('click', () => {
      console.log(sheetPos, entity);
    });

    this.sheet.setEntity(sheetPos, entity);
    this.objectTable.set(entity, graphics);
    this.container.addChild(graphics);
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

    this.container.removeChild(graphics);
    this.objectTable.delete(entity);
    this.sheet.deleteEntity(sheetPos);
  }
}
