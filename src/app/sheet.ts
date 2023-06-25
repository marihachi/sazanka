import { SheetEntity } from './entity/entity.js';

export class Sheet {
  entities: Map<number, Map<number, SheetEntity>>;

  constructor() {
    this.entities = new Map();
  }

  setEntity(pos: [number, number], value: SheetEntity) {
    let row = this.entities.get(pos[1]);
    if (row == null) {
      row = new Map();
      this.entities.set(pos[1], row);
    }
    row.set(pos[0], value);
  }

  getEntity(pos: [number, number]) {
    const row = this.entities.get(pos[1]);
    if (row == null) {
      return undefined;
    }
    return row.get(pos[0]);
  }

  deleteEntity(pos: [number, number]) {
    const row = this.entities.get(pos[1]);
    if (row == null) {
      console.log(`unexpected: failed to delete a entity. (${pos[0]} ${pos[1]})`);
      return;
    }
    row.delete(pos[0]);
  }
}
