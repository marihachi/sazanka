import { SheetEntity } from './entity';

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
