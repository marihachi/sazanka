import { WireDirection } from './wire-direction.js';

export abstract class SheetEntity {
}

export class GateEntity extends SheetEntity {
  name: string;
  width: number;
  height: number;
  inputPorts: number;
  outputPorts: number;

  constructor(name: string, width: number, height: number, inputPorts: number, outputPorts: number) {
    super();
    this.name = name;
    this.width = width;
    this.height = height;
    this.inputPorts = inputPorts;
    this.outputPorts = outputPorts;
  }
}

export function isGateEntity(x: SheetEntity): x is GateEntity {
  return x instanceof GateEntity;
}

export class WireEntity extends SheetEntity {
  dir: WireDirection;

  constructor(dir: WireDirection) {
    super();
    this.dir = new WireDirection(dir.bits);
  }
}

export function isWireEntity(x: SheetEntity): x is WireEntity {
  return x instanceof WireEntity;
}
