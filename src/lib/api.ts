import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function jsonCreated<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 });
}

export function jsonError(error: unknown, correlationId?: string) {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
          code: error.code ?? "APP_ERROR",
          correlationId,
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          message: "Dados inválidos",
          code: "VALIDATION_ERROR",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
          correlationId,
        },
      },
      { status: 400 },
    );
  }

  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      scope: "api",
      message: "Unhandled error",
      correlationId,
      name: error instanceof Error ? error.name : "Unknown",
    }),
  );

  return NextResponse.json(
    {
      error: {
        message: "Erro interno do servidor",
        code: "INTERNAL_ERROR",
        correlationId,
      },
    },
    { status: 500 },
  );
}

export function getPagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get("pageSize") ?? "20") || 20),
  );
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}
