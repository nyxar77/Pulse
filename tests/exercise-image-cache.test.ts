import { describe, expect, test } from "bun:test";
import {
  clearExerciseImageCache,
  exerciseImageAccessCacheName,
  exerciseImageCacheName,
  exerciseImageLoadingEnabled,
  loadExerciseImage,
  maxCachedExerciseImages,
  setExerciseImageLoading,
} from "../src/lib/exercise-image-cache";

class MemoryImageCache {
  entries = new Map<string, Response>();

  async delete(request: Request) {
    return this.entries.delete(request.url);
  }

  async keys() {
    return [...this.entries.keys()].map((url) => new Request(url));
  }

  async match(request: Request) {
    return this.entries.get(request.url)?.clone();
  }

  async put(request: Request, response: Response) {
    this.entries.set(request.url, response);
  }
}

class MemoryCacheStorage {
  caches = new Map<string, MemoryImageCache>();

  async delete(name: string) {
    return this.caches.delete(name);
  }

  async has(name: string) {
    return this.caches.has(name);
  }

  async open(name: string) {
    const existing = this.caches.get(name);
    if (existing) return existing;
    const cache = new MemoryImageCache();
    this.caches.set(name, cache);
    return cache;
  }
}

describe("exercise image cache", () => {
  test("requires an explicit device-local opt-in", async () => {
    const storage = new MemoryCacheStorage();

    expect(await exerciseImageLoadingEnabled(storage)).toBeFalse();
    await setExerciseImageLoading(true, storage);
    expect(await exerciseImageLoadingEnabled(storage)).toBeTrue();
    expect(storage.caches.has(exerciseImageAccessCacheName)).toBeTrue();
  });

  test("disabling image loading removes only image caches", async () => {
    const storage = new MemoryCacheStorage();
    await storage.open("pulse-app-shell");
    await storage.open(exerciseImageCacheName);
    await setExerciseImageLoading(true, storage);

    await setExerciseImageLoading(false, storage);

    expect(storage.caches.has(exerciseImageAccessCacheName)).toBeFalse();
    expect(storage.caches.has(exerciseImageCacheName)).toBeFalse();
    expect(storage.caches.has("pulse-app-shell")).toBeTrue();
  });

  test("clears downloaded images without disabling future downloads", async () => {
    const storage = new MemoryCacheStorage();
    await setExerciseImageLoading(true, storage);
    await storage.open(exerciseImageCacheName);

    await clearExerciseImageCache(storage);

    expect(await exerciseImageLoadingEnabled(storage)).toBeTrue();
    expect(storage.caches.has(exerciseImageCacheName)).toBeFalse();
  });

  test("uses the cached image without another request", async () => {
    const cache = new MemoryImageCache();
    const request = new Request("https://example.com/press.webp");
    cache.entries.set(request.url, new Response("cached"));
    let fetches = 0;

    const response = await loadExerciseImage(
      request,
      {
        open: async (name) => {
          expect(name).toBe(exerciseImageCacheName);
          return cache;
        },
      },
      async () => {
        fetches += 1;
        return new Response("network");
      },
    );

    expect(await response.text()).toBe("cached");
    expect(fetches).toBe(0);
  });

  test("stores fetched images and removes the oldest beyond the limit", async () => {
    const cache = new MemoryImageCache();
    for (let index = 0; index < maxCachedExerciseImages; index += 1) {
      cache.entries.set(
        `https://example.com/${index}.webp`,
        new Response(String(index)),
      );
    }

    const newest = new Request("https://example.com/new.webp");
    const response = await loadExerciseImage(
      newest,
      { open: async () => cache },
      async () => new Response("new"),
    );

    expect(await response.text()).toBe("new");
    expect(cache.entries.size).toBe(maxCachedExerciseImages);
    expect(cache.entries.has("https://example.com/0.webp")).toBeFalse();
    expect(cache.entries.has(newest.url)).toBeTrue();
  });

  test("still loads from the network when device caching is unavailable", async () => {
    const response = await loadExerciseImage(
      new Request("https://example.com/row.webp"),
      { open: async () => Promise.reject(new Error("storage unavailable")) },
      async () => new Response("network"),
    );

    expect(await response.text()).toBe("network");
  });
});
