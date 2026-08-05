export const exerciseImageCacheName = "pulse-exercise-images-v1";
export const maxCachedExerciseImages = 40;

type ExerciseImageCache = Pick<Cache, "delete" | "keys" | "match" | "put">;

type ExerciseImageCacheStorage = {
  open(name: string): Promise<ExerciseImageCache>;
};

type ExerciseImageFetcher = (request: Request) => Promise<Response>;

export async function loadExerciseImage(
  request: Request,
  cacheStorage: ExerciseImageCacheStorage = caches,
  fetchImage: ExerciseImageFetcher = fetch,
): Promise<Response> {
  let cache: ExerciseImageCache | undefined;

  try {
    cache = await cacheStorage.open(exerciseImageCacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
  } catch {
    // Private browsing and storage pressure can make Cache Storage unavailable.
  }

  const response = await fetchImage(request);
  if (!cache || (!response.ok && response.type !== "opaque")) return response;

  try {
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    const overflow = Math.max(0, keys.length - maxCachedExerciseImages);
    await Promise.all(keys.slice(0, overflow).map((key) => cache.delete(key)));
  } catch {
    // A failed cache write must not block the image that already loaded.
  }

  return response;
}
