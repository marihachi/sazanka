import { Sheet } from './sheet.js';

/**
 * Represents the cell position on the sheet as a single index value.
*/
export class CellIndex {
  value: number;
  sheet: Sheet;

  constructor(raw: number, sheet: Sheet) {
    this.value = raw;
    this.sheet = sheet;
  }

  static fromPoint(cellPoint: CellPoint) {
    return new CellIndex(cellPoint.sheet.width * cellPoint.y + cellPoint.x, cellPoint.sheet);
  }

  static fromPointValue(x: number, y: number, sheet: Sheet) {
    return new CellIndex(sheet.width * y + x, sheet);
  }
}

/**
 * Represents the cell position on the sheet as 2D coordinates.
*/
export class CellPoint {
  x: number;
  y: number;
  sheet: Sheet;

  constructor(x: number, y: number, sheet: Sheet) {
    this.x = x;
    this.y = y;
    this.sheet = sheet;
  }

  static fromIndex(cellIndex: CellIndex): CellPoint {
    let x = cellIndex.value;
    let y = 0;
    while (x >= cellIndex.sheet.width) {
      x -= cellIndex.sheet.width;
      y++;
    }
    return new CellPoint(x, y, cellIndex.sheet);
  }

  static fromIndexValue(cellIndexValue: number, sheet: Sheet): CellPoint {
    let x = cellIndexValue;
    let y = 0;
    while (x >= sheet.width) {
      x -= sheet.width;
      y++;
    }
    return new CellPoint(x, y, sheet);
  }
}
