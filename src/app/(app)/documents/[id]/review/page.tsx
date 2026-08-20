import { requirePermission } from "@/domain/auth/service";
import { DocumentReviewPanel } from "@/components/document-review-panel";

export default async function DocumentReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("documents:review");
  const { id } = await params;
  return <DocumentReviewPanel documentId={id} />;
}
