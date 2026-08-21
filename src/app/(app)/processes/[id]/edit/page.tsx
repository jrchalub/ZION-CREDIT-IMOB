import { notFound } from "next/navigation";
import { requirePermission } from "@/domain/auth/service";
import { getProcess } from "@/domain/processes/service";
import { ProcessEditForm } from "@/components/process-edit-form";
import { AppError } from "@/lib/api";

export default async function EditProcessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("processes:write");
  const { id } = await params;

  let process;
  try {
    process = await getProcess(session, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  return (
    <ProcessEditForm
      process={{
        id: process.id,
        processNumber: process.processNumber,
        clientName: process.clientName,
        incomeProfile: process.incomeProfile,
        intendedBank: process.intendedBank,
        propertyValue: process.propertyValue,
        downPayment: process.downPayment,
        financedAmount: process.financedAmount,
        fgtsAmount: process.fgtsAmount,
        amortizationSystem: process.amortizationSystem,
        financingType: process.financingType,
      }}
    />
  );
}
