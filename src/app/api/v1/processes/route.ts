import { requirePermission } from "@/domain/auth/service";
import {
  createProcess,
  createProcessSchema,
  listProcesses,
} from "@/domain/processes/service";
import type { ProcessStatus } from "@/domain/process/status-machine";
import { PROCESS_STATUSES } from "@/domain/process/status-machine";
import { getPagination, jsonCreated, jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";

export async function GET(request: Request) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("processes:read");
    const url = new URL(request.url);
    const pagination = getPagination(url.searchParams);
    const statusParam = url.searchParams.get("status");
    const status =
      statusParam && (PROCESS_STATUSES as readonly string[]).includes(statusParam)
        ? (statusParam as ProcessStatus)
        : undefined;
    const data = await listProcesses(session, { ...pagination, status });
    return jsonOk(data);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function POST(request: Request) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("processes:write");
    const body = createProcessSchema.parse(await request.json());
    const meta = getRequestMeta(request);
    const process = await createProcess(session, body, { ...meta, correlationId });
    return jsonCreated(process);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
