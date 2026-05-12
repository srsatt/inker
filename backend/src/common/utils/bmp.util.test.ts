import { describe, expect, it } from 'bun:test';
import { encode1BitBmpFromGrayscale } from './bmp.util';

describe('bmp util', () => {
  it('encodes grayscale pixels as a 1-bit BMP', () => {
    const pixels = Buffer.from([
      255, 0,
      0, 255,
    ]);

    const bmp = encode1BitBmpFromGrayscale(pixels, 2, 2);

    expect(bmp.toString('ascii', 0, 2)).toBe('BM');
    expect(bmp.readUInt32LE(10)).toBe(62);
    expect(bmp.readUInt32LE(14)).toBe(40);
    expect(bmp.readInt32LE(18)).toBe(2);
    expect(bmp.readInt32LE(22)).toBe(2);
    expect(bmp.readUInt16LE(28)).toBe(1);
    expect(bmp.readUInt32LE(46)).toBe(2);
    expect(bmp.readUInt32LE(54)).toBe(0x00000000);
    expect(bmp.readUInt32LE(58)).toBe(0x00ffffff);

    const pixelOffset = bmp.readUInt32LE(10);
    expect(bmp[pixelOffset]).toBe(0b01000000);
    expect(bmp[pixelOffset + 4]).toBe(0b10000000);
  });
});
