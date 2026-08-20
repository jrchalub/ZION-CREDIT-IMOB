import { nanoid } from "nanoid";

export function createCorrelationId(request: Request): string {
  return request.headers.get("x-correlation-id") ?? nanoid(12);
}

export function getRequestMeta(request: Request) {
  return {
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}
