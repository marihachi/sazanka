import { Sprite } from 'kontra';
import { WireDirection } from './wire-direction.js';

export type SheetEntity = GateEntity | WireEntity;

export type GateEntity = {
  kind: 'gate',
  name: string,
  width: number,
  height: number,
  inputPorts: number,
  outputPorts: number,
  sprite?: Sprite,
};

export function GATE(name: string, width: number, height: number, inputPorts: number, outputPorts: number): SheetEntity {
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
  dir: WireDirection,
  sprite?: Sprite,
};

export function WIRE(dir: WireDirection): SheetEntity {
  return {
    kind: 'wire',
    dir: new WireDirection(dir.bits),
  };
}
