import { SheetEntity } from './entity.js';

export class Sheet {
  width: number;
  height: number;
  entities: Map<number, SheetEntity>;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.entities = new Map();
  }
}
