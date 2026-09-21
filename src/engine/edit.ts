import { Point } from './layout';
import type { Circuit, Component, PinRef } from './circuit';

function updateComponent<T extends Circuit>(circuit: T, id: string, update: (c: Component) => Component): T {
  return { ...circuit, components: circuit.components.map((c) => (c.id === id ? update(c) : c)) };
}

function isWireTo(to: PinRef) {
  return (w: { to: PinRef }) => w.to.comp === to.comp && w.to.pin === to.pin;
}

export function addComponent<T extends Circuit>(circuit: T, c: Component): T {
  return { ...circuit, components: [...circuit.components, c] };
}

/** 部品と、それにつながる配線を削除する */
export function removeComponent<T extends Circuit>(circuit: T, id: string): T {
  return removeComponents(circuit, [id]);
}

/** 複数の部品と、それらにつながる配線をまとめて削除する */
export function removeComponents<T extends Circuit>(circuit: T, ids: readonly string[]): T {
  const set = new Set(ids);
  return {
    ...circuit,
    components: circuit.components.filter((c) => !set.has(c.id)),
    wires: circuit.wires.filter((w) => !set.has(w.from.comp) && !set.has(w.to.comp)),
  };
}

export function removeWire<T extends Circuit>(circuit: T, id: string): T {
  return { ...circuit, wires: circuit.wires.filter((w) => w.id !== id) };
}

export function moveComponent<T extends Circuit>(circuit: T, id: string, { x, y }: Point): T {
  return updateComponent(circuit, id, (c) => ({ ...c, x, y }));
}

/** 複数の部品をまとめて動かす。positions にない部品はそのまま */
export function moveComponents<T extends Circuit>(circuit: T, positions: ReadonlyMap<string, Point>): T {
  return {
    ...circuit,
    components: circuit.components.map((c) => {
      const p = positions.get(c.id);
      return p ? { ...c, x: p.x, y: p.y } : c;
    }),
  };
}

export function toggleSwitch<T extends Circuit>(circuit: T, id: string): T {
  return updateComponent(circuit, id, (c) => ({ ...c, on: !c.on }));
}

/** 空白だけのラベルは、ラベルなしにする */
export function setLabel<T extends Circuit>(circuit: T, id: string, value: string): T {
  return updateComponent(circuit, id, (c) => ({ ...c, label: value.trim() || undefined }));
}

/** 入力ピンにつなげる配線は1本だけなので、既存の配線は置き換える */
export function connect<T extends Circuit>(circuit: T, id: string, from: PinRef, to: PinRef): T {
  return { ...circuit, wires: [...circuit.wires.filter((w) => !isWireTo(to)(w)), { id, from, to }] };
}

/** 入力ピンにつながった配線を外す */
export function disconnect<T extends Circuit>(circuit: T, to: PinRef): T {
  return { ...circuit, wires: circuit.wires.filter((w) => !isWireTo(to)(w)) };
}
