import { describe, expect, it } from 'vitest';
import {
  addComponent,
  connect,
  disconnect,
  moveComponent,
  removeComponent,
  removeWire,
  setLabel,
  toggleSwitch,
} from './edit';
import type { CircuitDef } from './project';
import type { Circuit, Wire } from './sim';

function wire(id: string, from: string, to: string, toPin = 0): Wire {
  return { id, from: { comp: from, pin: 0 }, to: { comp: to, pin: toPin } };
}

const base: Circuit = {
  components: [
    { id: 'a', kind: 'INPUT', x: 0, y: 0, on: false },
    { id: 'b', kind: 'INPUT', x: 0, y: 40, on: false },
    { id: 'g', kind: 'AND', x: 80, y: 0 },
    { id: 'o', kind: 'OUTPUT', x: 160, y: 0 },
  ],
  wires: [wire('w1', 'a', 'g', 0), wire('w2', 'b', 'g', 1), wire('w3', 'g', 'o')],
};

describe('edit', () => {
  it('部品を削除すると、つながる配線も消える', () => {
    const c = removeComponent(base, 'g');
    expect(c.components.map((k) => k.id)).toEqual(['a', 'b', 'o']);
    expect(c.wires).toEqual([]);
  });

  it('つながった入力ピンに接続すると、既存の配線を置き換える', () => {
    const c = connect(base, 'w4', { comp: 'b', pin: 0 }, { comp: 'g', pin: 0 });
    expect(c.wires.map((w) => w.id)).toEqual(['w2', 'w3', 'w4']);
  });

  it('配線を外すのは指定した入力ピンのものだけ', () => {
    const c = disconnect(base, { comp: 'g', pin: 1 });
    expect(c.wires.map((w) => w.id)).toEqual(['w1', 'w3']);
  });

  it('空白だけのラベルはラベルなしになる', () => {
    const labeled = setLabel(base, 'a', ' x ');
    expect(labeled.components[0].label).toBe('x');
    expect(setLabel(labeled, 'a', '  ').components[0].label).toBeUndefined();
  });

  it('配線を削除しても、部品はそのまま', () => {
    const c = removeWire(base, 'w2');
    expect(c.wires.map((w) => w.id)).toEqual(['w1', 'w3']);
    expect(c.components).toBe(base.components);
  });

  it('部品の追加と移動', () => {
    const added = addComponent(base, { id: 'n', kind: 'NOT', x: 0, y: 80 });
    expect(added.components.map((k) => k.id)).toEqual(['a', 'b', 'g', 'o', 'n']);
    const moved = moveComponent(added, 'n', { x: 40, y: 120 });
    expect(moved.components[4]).toMatchObject({ x: 40, y: 120 });
    expect(moved.components[0]).toBe(added.components[0]);
  });

  it('回路定義の ID や名前は編集しても残る', () => {
    const def: CircuitDef = { ...base, id: 'm', name: 'M' };
    expect(removeWire(removeComponent(def, 'g'), 'w1')).toMatchObject({ id: 'm', name: 'M' });
  });

  it('スイッチの ON/OFF を切り替える', () => {
    expect(toggleSwitch(base, 'a').components[0].on).toBe(true);
  });
});
