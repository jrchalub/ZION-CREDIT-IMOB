export type ClassificationDecision =
  | "AUTO_SUGGESTED"
  | "REQUIRES_REVIEW"
  | "LOW_CONFIDENCE";

export type OrganizeDecision =
  | { action: "organize"; typeCode: string }
  | { action: "review"; reason: "LOW_CONFIDENCE" | "REQUIRES_REVIEW" | "UNKNOWN_TYPE" };

/**
 * Never invent a type. Only AUTO_SUGGESTED + known mapped code may auto-file.
 */
export function decideOrganizeAction(input: {
  decision: ClassificationDecision | string | null;
  matchedTypeCode: string | null;
  humanSelectedTypeCode?: string | null;
}): OrganizeDecision {
  if (input.humanSelectedTypeCode) {
    return { action: "organize", typeCode: input.humanSelectedTypeCode };
  }
  if (!input.matchedTypeCode) {
    return { action: "review", reason: "UNKNOWN_TYPE" };
  }
  if (input.decision === "AUTO_SUGGESTED") {
    return { action: "organize", typeCode: input.matchedTypeCode };
  }
  if (input.decision === "LOW_CONFIDENCE") {
    return { action: "review", reason: "LOW_CONFIDENCE" };
  }
  return { action: "review", reason: "REQUIRES_REVIEW" };
}

export function mergeIntakeMetadata(
  current: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...(current ?? {}),
    intake: "inbox",
    ...patch,
  };
}
