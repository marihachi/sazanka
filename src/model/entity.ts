import { Sprite } from 'kontra';
import { DirectionSet } from './direction.js';

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
  dir: DirectionSet,
  sprite?: Sprite,
};

export function WIRE(dir: DirectionSet): Entity {
  return {
    kind: 'wire',
    dir: dir,
  };
}
