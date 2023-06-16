import { Sprite } from 'kontra';

export type Sheet = {
  width: number,
  height: number,
  entities: Map<number, Entity>,
};

export function createSheet(width: number, height: number): Sheet {
  return {
    width,
    height,
    entities: new Map(),
  };
}

export type Entity = GateEntity | WireEntity;

export type GateEntity = {
  kind: 'gate',
  name: string,
  width: number,
  height: number,
  inputPorts: number,
  outputPorts: number,
  sprite?: Sprite,
};

export function GATE(name: string, width: number, height: number, inputPorts: number, outputPorts: number): Entity {
  return {
    kind: 'gate',
    name,
    width,
    height,
    inputPorts,
    outputPorts,
  };
}

export type WireEntity = {
  kind: 'wire',
  dirBits: DirBits,
  sprite?: Sprite,
};

export function WIRE(dirBits: DirBits): Entity {
  return {
    kind: 'wire',
    dirBits: dirBits,
  };
}

export type MapPos = { x: number, y: number };

export function calcPos(CellId: number, sheetWidth: number): MapPos {
  let x = CellId;
  let y = 0;
  while (x >= sheetWidth) {
    x -= sheetWidth;
    y++;
  }
  return { x, y };
}

export function calcCellId(pos: MapPos, sheetWidth: number): number {
  return sheetWidth * pos.y + pos.x;
}

/**
 * wire direction
 * 
 * Bit layout:
 * [3] Right, [2] Left, [1] Bottom, [0] Top
 * 
 * Example:
 * 0xC (Left and Right),
 * 0x6 (Left and Bottom)
*/
export type DirBits = number;

export const TOP = 1;
export const BOTTOM = 2;
export const LEFT = 4;
export const RIGHT = 8;
