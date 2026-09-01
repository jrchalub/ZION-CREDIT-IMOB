import { redirect } from "next/navigation";
import { requirePermission } from "@/domain/auth/service";
import NewUserPage from "./page-client";

export default async function NewUserPageGuard() {
  const session = await requirePermission("users:write");
  if (session.role !== "ADMIN") {
    redirect("/users");
  }

  return <NewUserPage />;
}
