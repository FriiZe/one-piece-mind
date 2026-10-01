import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeSilhouette } from "../scripts/images/silhouettes";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "silhouettes-"));
});
afterAll(() => rm(dir, { recursive: true, force: true }));

/** Carré rouge de 10 px au centre d'une image de 20 px, sur fond transparent ou blanc. */
async function portrait(file: string, background: { r: number; g: number; b: number; alpha: number }) {
  const square = await sharp({
    create: { width: 10, height: 10, channels: 4, background: { r: 215, g: 38, b: 61, alpha: 1 } },
  })
    .png()
    .toBuffer();
  await sharp({ create: { width: 20, height: 20, channels: 4, background } })
    .composite([{ input: square, left: 5, top: 5 }])
    .png()
    .toFile(file);
}

describe("makeSilhouette", () => {
  it("remplace le personnage par une forme noire et garde le fond transparent", async () => {
    const source = path.join(dir, "in.png");
    const target = path.join(dir, "out/in.png");
    await portrait(source, { r: 0, g: 0, b: 0, alpha: 0 });

    expect(await makeSilhouette(source, target)).toEqual({ ok: true });

    const { data, info } = await sharp(target).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => [...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)];
    expect([info.width, info.height]).toEqual([20, 20]);
    expect(pixel(10, 10)).toEqual([0, 0, 0, 255]);
    expect(pixel(1, 1)[3]).toBe(0);
  });

  it("refuse un portrait non détouré", async () => {
    const source = path.join(dir, "opaque.png");
    await portrait(source, { r: 255, g: 255, b: 255, alpha: 1 });
    const result = await makeSilhouette(source, path.join(dir, "out/opaque.png"));
    expect(result.ok).toBe(false);
  });
});
