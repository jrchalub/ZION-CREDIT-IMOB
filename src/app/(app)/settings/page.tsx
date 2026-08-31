import { requirePermission } from "@/domain/auth/service";
import { TenantSettingsForm } from "@/components/tenant-settings-form";

export default async function SettingsPage() {
  await requirePermission("settings:write");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Configurações</h1>
        <p className="mt-1 text-sm text-slate-600">
          Controles do escritório. Não enviam documentos automaticamente a banco.
        </p>
      </div>
      <TenantSettingsForm />
    </div>
  );
}
