import type { StorageProvider } from "./types";
import { MinioStorageProvider } from "./minio-provider";

let cached: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!cached) {
    cached = new MinioStorageProvider();
  }
  return cached;
}
