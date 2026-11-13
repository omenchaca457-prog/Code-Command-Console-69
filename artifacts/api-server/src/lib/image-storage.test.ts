import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createImageStorage, isImageId } from "./image-storage.ts";

const EXISTING_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("persistent creator image storage", () => {
  it("preserves PNG bytes across storage instances and keeps images separate", async (t) => {
    const dataDirectory = await mkdtemp(join(tmpdir(), "devterminal-images-"));
    t.after(() => rm(dataDirectory, { recursive: true, force: true }));
    const storage = createImageStorage(dataDirectory);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const id = await storage.storeImage(png);
    const secondId = await storage.storeImage(Buffer.from("second image"));

    assert.ok(isImageId(id));
    assert.notEqual(id, secondId);
    assert.deepEqual(await readFile(join(dataDirectory, "creator", `${id}.png`)), png);
    assert.deepEqual(await createImageStorage(dataDirectory).loadImage(id), png);
    assert.deepEqual(await storage.loadImage(secondId), Buffer.from("second image"));
  });

  it("reads migrated creator UUID filenames without changing their public IDs", async (t) => {
    const dataDirectory = await mkdtemp(join(tmpdir(), "devterminal-images-"));
    t.after(() => rm(dataDirectory, { recursive: true, force: true }));
    await mkdir(join(dataDirectory, "creator"));
    await writeFile(join(dataDirectory, "creator", `${EXISTING_ID}.png`), "migrated PNG");

    assert.deepEqual(await createImageStorage(dataDirectory).loadImage(EXISTING_ID), Buffer.from("migrated PNG"));
  });

  it("returns no image for absent files and invalid or traversal IDs", async (t) => {
    const dataDirectory = await mkdtemp(join(tmpdir(), "devterminal-images-"));
    t.after(() => rm(dataDirectory, { recursive: true, force: true }));
    const storage = createImageStorage(dataDirectory);
    await writeFile(join(dataDirectory, "private.png"), "outside creator");

    assert.equal(await storage.loadImage(EXISTING_ID), null);
    for (const id of ["../private", "../../private", `${EXISTING_ID}/../private`, "-".repeat(36), `${EXISTING_ID}.png`]) {
      assert.equal(await storage.loadImage(id), null, id);
    }
  });

  it("does not serve symlink targets or directories as PNGs", async (t) => {
    const dataDirectory = await mkdtemp(join(tmpdir(), "devterminal-images-"));
    t.after(() => rm(dataDirectory, { recursive: true, force: true }));
    const storage = createImageStorage(dataDirectory);
    await mkdir(storage.directory);
    const privateFile = join(dataDirectory, "private.txt");
    await writeFile(privateFile, "private data");
    const filename = join(storage.directory, `${EXISTING_ID}.png`);
    try {
      await symlink(privateFile, filename);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "ENOTSUP") {
        t.skip("This platform does not permit creating test symlinks.");
        return;
      }
      throw error;
    }
    assert.equal(await storage.loadImage(EXISTING_ID), null);
    await rm(filename);
    await mkdir(filename);
    assert.equal(await storage.loadImage(EXISTING_ID), null);
  });

  it("rejects a failed disk write instead of returning a successful ID", async (t) => {
    const dataDirectory = await mkdtemp(join(tmpdir(), "devterminal-images-"));
    t.after(() => rm(dataDirectory, { recursive: true, force: true }));
    await writeFile(join(dataDirectory, "creator"), "not a directory");

    await assert.rejects(createImageStorage(dataDirectory).storeImage(Buffer.from("PNG")));
  });
});
