import { SheetEntity } from './entity.js';

export class GateEntity extends SheetEntity {
  name: string;
  inputPorts: number;
  outputPorts: number;

  constructor(name: string, width: number, height: number, inputPorts: number, outputPorts: number) {
    super(width, height);
    this.name = name;
    this.inputPorts = inputPorts;
    this.outputPorts = outputPorts;
  }
}

export function isGateEntity(x: SheetEntity): x is GateEntity {
  return x instanceof GateEntity;
}
