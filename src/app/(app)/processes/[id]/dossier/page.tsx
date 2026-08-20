import { requirePermission } from "@/domain/auth/service";
import { ProcessDossierView } from "./dossier-view";

export default async function ProcessDossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("decision:read");
  const { id } = await params;
  return <ProcessDossierView processId={id} />;
}
