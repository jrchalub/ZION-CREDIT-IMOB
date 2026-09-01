import * as Minio from "minio";
import type { PutObjectInput, SignedUrlInput, StorageProvider } from "./types";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export class MinioStorageProvider implements StorageProvider {
  readonly name = "minio";
  private readonly client: Minio.Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.MINIO_BUCKET ?? "zion-credit-documents";
    this.client = new Minio.Client({
      endPoint: required("MINIO_ENDPOINT"),
      port: Number(process.env.MINIO_PORT ?? "9000"),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: required("MINIO_ACCESS_KEY"),
      secretKey: required("MINIO_SECRET_KEY"),
      region: process.env.MINIO_REGION ?? "us-east-1",
    });
  }

  async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(
        this.bucket,
        process.env.MINIO_REGION ?? "us-east-1",
      );
    }
  }

  async putObject(input: PutObjectInput): Promise<{ key: string }> {
    await this.ensureBucket();
    await this.client.putObject(
      this.bucket,
      input.key,
      input.body,
      input.body.length,
      {
        "Content-Type": input.contentType,
        ...(input.metadata ?? {}),
      },
    );
    return { key: input.key };
  }

  async getObject(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  async getSignedUrl(input: SignedUrlInput): Promise<string> {
    const expires = input.expiresInSeconds ?? 120;
    const client = this.getSigningClient();
    if (input.method === "PUT") {
      return client.presignedPutObject(this.bucket, input.key, expires);
    }
    return client.presignedGetObject(this.bucket, input.key, expires);
  }

  /** Presign with public endpoint when MINIO_PUBLIC_ENDPOINT is set. */
  private getSigningClient(): Minio.Client {
    const publicEndpoint = process.env.MINIO_PUBLIC_ENDPOINT?.trim();
    if (!publicEndpoint) return this.client;

    return new Minio.Client({
      endPoint: publicEndpoint,
      port: Number(process.env.MINIO_PUBLIC_PORT ?? process.env.MINIO_PORT ?? "9000"),
      useSSL: process.env.MINIO_PUBLIC_USE_SSL === "true",
      accessKey: required("MINIO_ACCESS_KEY"),
      secretKey: required("MINIO_SECRET_KEY"),
      region: process.env.MINIO_REGION ?? "us-east-1",
    });
  }
}
