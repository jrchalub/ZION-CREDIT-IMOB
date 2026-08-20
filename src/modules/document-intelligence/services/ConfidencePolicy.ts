export function getClassificationThresholds() {
  return {
    auto: Number(process.env.AI_CLASSIFICATION_AUTO_THRESHOLD ?? "0.90"),
    review: Number(process.env.AI_CLASSIFICATION_REVIEW_THRESHOLD ?? "0.70"),
  };
}

export type ClassificationDecision =
  | "AUTO_SUGGESTED"
  | "REQUIRES_REVIEW"
  | "LOW_CONFIDENCE";

export function decideClassification(confidence: number): ClassificationDecision {
  const { auto, review } = getClassificationThresholds();
  if (confidence >= auto) return "AUTO_SUGGESTED";
  if (confidence >= review) return "REQUIRES_REVIEW";
  return "LOW_CONFIDENCE";
}
