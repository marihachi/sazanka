import { Sprite } from 'kontra';
import { BOTTOM, GateEntity, LEFT, MapPos, RIGHT, TOP, WireEntity } from './sheet.js';

export const cellViewSize = 8;

export function createBackground(width: number, height: number): Sprite {
  const sprite = Sprite({
    x: 0,
    y: 0,
    width: width,
    height: height,
    color: '#181818',
  });
  return sprite;
}

export function createGate(mapPos: MapPos, entity: GateEntity): Sprite {
  const width = entity.width * cellViewSize;
  const height = entity.height * cellViewSize;
  const sprite = Sprite({
    x: mapPos.x * cellViewSize,
    y: mapPos.y * cellViewSize,
    width: width,
    height: height,
    render() {
      if (this.context == null) {
        return;
      }
      const ctx = this.context;
      ctx.beginPath();
      ctx.lineCap = 'square';

      // draw gate
      ctx.rect(0, 0, width, height);
      ctx.fillStyle = '#1c1c1c';
      ctx.fill();
      ctx.strokeStyle = '#555';
      ctx.stroke();

      // draw name (center top)
      ctx.font = '16px consolas';
      const nameMetrics = ctx.measureText(entity.name);
      ctx.fillStyle = '#AAA';
      ctx.fillText(entity.name, width / 2 - nameMetrics.width / 2, 18);
    }
  });
  return sprite;
}

export function createWire(mapPos: MapPos, entity: WireEntity): Sprite {
  const half = cellViewSize / 2;
  const sprite = Sprite({
    x: mapPos.x * cellViewSize,
    y: mapPos.y * cellViewSize,
    width: cellViewSize,
    height: cellViewSize,
    render() {
      if (this.context == null) {
        return;
      }
      const ctx = this.context;
      ctx.beginPath();
      ctx.lineCap = 'square';
      if ((entity.dirBits & TOP) != 0) {
        ctx.moveTo(half, half);
        ctx.lineTo(half, 0);
      }
      if ((entity.dirBits & LEFT) != 0) {
        ctx.moveTo(half, half);
        ctx.lineTo(0, half);
      }
      if ((entity.dirBits & BOTTOM) != 0) {
        ctx.moveTo(half, half);
        ctx.lineTo(half, cellViewSize);
      }
      if ((entity.dirBits & RIGHT) != 0) {
        ctx.moveTo(half, half);
        ctx.lineTo(cellViewSize, half);
      }
      ctx.strokeStyle = '#999';
      ctx.stroke();
    }
  });
  return sprite;
}
