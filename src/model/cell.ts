import { Point } from './point.js';
import { Sheet } from './sheet.js';

export class CellIndex {
  value: number;
  sheet: Sheet;

  constructor(raw: number, sheet: Sheet) {
    this.value = raw;
    this.sheet = sheet;
  }

  static fromPoint(point: Point) {
    return new CellIndex(point.sheet.width * point.y + point.x, point.sheet);
  }

  static fromPointValue(x: number, y: number, sheet: Sheet) {
    return new CellIndex(sheet.width * y + x, sheet);
  }
}
