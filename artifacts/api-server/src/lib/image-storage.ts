import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const IMAGE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isImageId(value: string): boolean {
  return IMAGE_ID_PATTERN.test(value);
}

function isMissingFile(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return code === "ENOENT" || code === "ENOTDIR" || code === "ELOOP";
}

/** Persistent PNG storage. Existing creator/<UUID>.png files can be copied here unchanged. */
export function createImageStorage(dataDirectory = process.env.DATA_DIR || "data") {
  const directory = resolve(dataDirectory, "creator");

  return {
    directory,

    async storeImage(image: Buffer): Promise<string> {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const id = randomUUID();
      await writeFile(resolve(directory, `${id}.png`), image, { flag: "wx", mode: 0o600 });
      return id;
    },

    async loadImage(id: string): Promise<Buffer | null> {
      if (!isImageId(id)) return null;
      const filename = resolve(directory, `${id}.png`);
      try {
        // Reject symlinks and special files before opening. O_NOFOLLOW also covers
        // a symlink introduced between this check and open on supporting systems.
        const expected = await lstat(filename);
        if (!expected.isFile()) return null;
        const file = await open(
          filename,
          constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0),
        );
        try {
          const actual = await file.stat();
          if (!actual.isFile() || actual.dev !== expected.dev || actual.ino !== expected.ino) return null;
          return await file.readFile();
        } finally {
          await file.close();
        }
      } catch (error) {
        if (isMissingFile(error)) return null;
        throw error;
      }
    },
  };
}
