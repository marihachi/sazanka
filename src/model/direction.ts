/*
 * direction set data
 * 
 * Bit layout:
 * [3] Right, [2] Left, [1] Bottom, [0] Top
 * 
 * Example:
 * 0xC (Left and Right),
 * 0x6 (Left and Bottom)
*/

export class DirectionSet {
  bits: number;

  constructor(bits: number = 0) {
    this.bits = bits;
  }

  hasTop() {
    return (this.bits & DirectionSet.top) != 0;
  }

  hasBottom() {
    return (this.bits & DirectionSet.bottom) != 0;
  }

  hasLeft() {
    return (this.bits & DirectionSet.left) != 0;
  }

  hasRight() {
    return (this.bits & DirectionSet.right) != 0;
  }

  enableTop() {
    this.bits += DirectionSet.top;
  }

  enableBottom() {
    this.bits += DirectionSet.bottom;
  }

  enableLeft() {
    this.bits += DirectionSet.left;
  }

  enableRight() {
    this.bits += DirectionSet.right;
  }

  static readonly top: number = 1;
  static readonly bottom: number = 2;
  static readonly left: number = 4;
  static readonly right: number = 8;
}
