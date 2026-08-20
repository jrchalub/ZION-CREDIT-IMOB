export type PutObjectInput = {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
};

export type SignedUrlInput = {
  key: string;
  expiresInSeconds?: number;
  method?: "GET" | "PUT";
};

export interface StorageProvider {
  readonly name: string;
  ensureBucket(): Promise<void>;
  putObject(input: PutObjectInput): Promise<{ key: string }>;
  getObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
  getSignedUrl(input: SignedUrlInput): Promise<string>;
}
