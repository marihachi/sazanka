import { CellIndex } from './cell.js';
import { Sheet } from './sheet.js';

export class Point {
  x: number;
  y: number;
  sheet: Sheet;

  constructor(x: number, y: number, sheet: Sheet) {
    this.x = x;
    this.y = y;
    this.sheet = sheet;
  }

  static fromCellIndex(cellIndex: CellIndex): Point {
    let x = cellIndex.value;
    let y = 0;
    while (x >= cellIndex.sheet.width) {
      x -= cellIndex.sheet.width;
      y++;
    }
    return new Point(x, y, cellIndex.sheet);
  }

  static fromCellIndexValue(cellIndexValue: number, sheet: Sheet): Point {
    let x = cellIndexValue;
    let y = 0;
    while (x >= sheet.width) {
      x -= sheet.width;
      y++;
    }
    return new Point(x, y, sheet);
  }
}
