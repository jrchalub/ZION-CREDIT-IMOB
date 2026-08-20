import { ClientPortalPage } from "./portal-client";

export default async function PortalTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ClientPortalPage token={decodeURIComponent(token)} />;
}
