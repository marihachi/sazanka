import { describe, expect, it } from 'vitest';
import { getExportFileName } from './localFile';

describe('getExportFileName', () => {
  it('端末の時刻の日付を、月と日を 2 桁にして付ける', () => {
    expect(getExportFileName(new Date(2026, 9, 11, 23, 59))).toBe('sazanka-2026-10-11.json');
    expect(getExportFileName(new Date(2027, 0, 5, 0, 0))).toBe('sazanka-2027-01-05.json');
  });
});
