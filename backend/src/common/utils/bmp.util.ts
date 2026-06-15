import sharp from './sharp';

const BMP_FILE_HEADER_SIZE = 14;
const DIB_HEADER_SIZE = 40;
const PALETTE_SIZE = 8;
const BMP_HEADER_SIZE = BMP_FILE_HEADER_SIZE + DIB_HEADER_SIZE + PALETTE_SIZE;

export function encode1BitBmpFromGrayscale(
  data: Buffer,
  width: number,
  height: number,
  threshold: number = 128,
): Buffer {
  const rowStride = Math.ceil(width / 8);
  const paddedRowStride = Math.ceil(rowStride / 4) * 4;
  const pixelDataSize = paddedRowStride * height;
  const fileSize = BMP_HEADER_SIZE + pixelDataSize;
  const output = Buffer.alloc(fileSize);

  output.write('BM', 0, 'ascii');
  output.writeUInt32LE(fileSize, 2);
  output.writeUInt32LE(BMP_HEADER_SIZE, 10);

  output.writeUInt32LE(DIB_HEADER_SIZE, 14);
  output.writeInt32LE(width, 18);
  output.writeInt32LE(height, 22);
  output.writeUInt16LE(1, 26);
  output.writeUInt16LE(1, 28);
  output.writeUInt32LE(0, 30);
  output.writeUInt32LE(pixelDataSize, 34);
  output.writeInt32LE(2835, 38);
  output.writeInt32LE(2835, 42);
  output.writeUInt32LE(2, 46);
  output.writeUInt32LE(2, 50);

  // Palette entries are BGRA. Index 0 = black, index 1 = white.
  output.writeUInt32LE(0x00000000, 54);
  output.writeUInt32LE(0x00ffffff, 58);

  const pixelOffset = BMP_HEADER_SIZE;
  for (let y = 0; y < height; y++) {
    const sourceY = height - 1 - y;
    const rowOffset = pixelOffset + y * paddedRowStride;

    for (let x = 0; x < width; x++) {
      const pixel = data[sourceY * width + x];
      if (pixel >= threshold) {
        output[rowOffset + Math.floor(x / 8)] |= 0x80 >> (x % 8);
      }
    }
  }

  return output;
}

export function rgbaToGrayscale(data: Uint8Array, width: number, height: number): Buffer {
  const output = Buffer.alloc(width * height);
  for (let i = 0, pixel = 0; i < data.length; i += 4, pixel++) {
    const alpha = data[i + 3] ?? 255;
    const gray = Math.round((data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000);
    output[pixel] = Math.round((gray * alpha + 255 * (255 - alpha)) / 255);
  }
  return output;
}

export function encode1BitBmpFromRgba(
  data: Uint8Array,
  width: number,
  height: number,
  threshold: number = 128,
): Buffer {
  return encode1BitBmpFromGrayscale(rgbaToGrayscale(data, width, height), width, height, threshold);
}

export async function imageBufferTo1BitBmp(
  imageBuffer: Buffer,
  threshold: number = 128,
): Promise<Buffer> {
  const { data, info } = await sharp(imageBuffer)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return encode1BitBmpFromGrayscale(data, info.width, info.height, threshold);
}
