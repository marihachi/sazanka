import { SheetEntity } from './entity.js';

export class WireEntity extends SheetEntity {
  dir: WireDirection;

  constructor(dir: WireDirection) {
    super(1, 1);
    this.dir = new WireDirection(dir.bits);
  }
}

export function isWireEntity(x: SheetEntity): x is WireEntity {
  return x instanceof WireEntity;
}

/*
 * direction data for wire entity
 * 
 * Bit layout:
 * [3] Right, [2] Left, [1] Bottom, [0] Top
 * 
 * Example:
 * 0xC (Left and Right),
 * 0x6 (Left and Bottom)
*/

export class WireDirection {
  bits: number;

  constructor(bits: number = 0) {
    this.bits = bits;
  }

  hasTop() {
    return (this.bits & WireDirection.top) != 0;
  }

  hasBottom() {
    return (this.bits & WireDirection.bottom) != 0;
  }

  hasLeft() {
    return (this.bits & WireDirection.left) != 0;
  }

  hasRight() {
    return (this.bits & WireDirection.right) != 0;
  }

  setTop() {
    this.bits += WireDirection.top;
    return this;
  }

  setBottom() {
    this.bits += WireDirection.bottom;
    return this;
  }

  setLeft() {
    this.bits += WireDirection.left;
    return this;
  }

  setRight() {
    this.bits += WireDirection.right;
    return this;
  }

  clear() {
    this.bits = 0;
    return this;
  }

  static readonly top: number = 1;
  static readonly bottom: number = 2;
  static readonly left: number = 4;
  static readonly right: number = 8;
}
