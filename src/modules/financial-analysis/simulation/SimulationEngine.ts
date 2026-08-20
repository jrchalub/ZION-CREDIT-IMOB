export type AmortizationSystem = "SAC" | "PRICE";

export type SimulationInput = {
  propertyValue: number;
  downPayment: number;
  fgtsAmount: number;
  termMonths: number;
  annualRatePct: number;
  amortizationSystem: AmortizationSystem;
  /** Optional override; otherwise property − down − fgts */
  financedAmount?: number;
};

export type ScheduleRow = {
  n: number;
  installment: number;
  interest: number;
  amortization: number;
  balance: number;
};

export type SimulationResult = {
  propertyValue: number;
  downPayment: number;
  fgtsAmount: number;
  financedAmount: number;
  termMonths: number;
  annualRatePct: number;
  amortizationSystem: AmortizationSystem;
  firstInstallment: number;
  lastInstallment: number;
  averageInstallment: number;
  totalInterest: number;
  scheduleSummary: ScheduleRow[];
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function monthlyRate(annualRatePct: number) {
  return annualRatePct / 100 / 12;
}

function buildPriceSchedule(
  principal: number,
  n: number,
  i: number,
): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  let balance = principal;
  const installment =
    i === 0
      ? principal / n
      : (principal * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);

  for (let k = 1; k <= n; k++) {
    const interest = balance * i;
    const amortization = installment - interest;
    balance = Math.max(0, balance - amortization);
    rows.push({
      n: k,
      installment: round2(installment),
      interest: round2(interest),
      amortization: round2(amortization),
      balance: round2(balance),
    });
  }
  return rows;
}

function buildSacSchedule(
  principal: number,
  n: number,
  i: number,
): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  let balance = principal;
  const amortizationFixed = principal / n;

  for (let k = 1; k <= n; k++) {
    const interest = balance * i;
    const installment = amortizationFixed + interest;
    balance = Math.max(0, balance - amortizationFixed);
    rows.push({
      n: k,
      installment: round2(installment),
      interest: round2(interest),
      amortization: round2(amortizationFixed),
      balance: round2(balance),
    });
  }
  return rows;
}

/**
 * Pure SAC/PRICE simulation. Returns first/last/average installment and a
 * compact schedule (first 3 + last 3 when term is long).
 */
export function simulateFinancing(input: SimulationInput): SimulationResult {
  const financedAmount = round2(
    input.financedAmount ??
      Math.max(0, input.propertyValue - input.downPayment - input.fgtsAmount),
  );
  const termMonths = Math.max(1, Math.floor(input.termMonths));
  const i = monthlyRate(input.annualRatePct);

  const full =
    input.amortizationSystem === "PRICE"
      ? buildPriceSchedule(financedAmount, termMonths, i)
      : buildSacSchedule(financedAmount, termMonths, i);

  const installments = full.map((r) => r.installment);
  const firstInstallment = installments[0] ?? 0;
  const lastInstallment = installments[installments.length - 1] ?? 0;
  const averageInstallment = round2(
    installments.reduce((a, b) => a + b, 0) / installments.length,
  );
  const totalInterest = round2(full.reduce((a, r) => a + r.interest, 0));

  let scheduleSummary = full;
  if (full.length > 8) {
    scheduleSummary = [
      ...full.slice(0, 3),
      ...full.slice(-3),
    ];
  }

  return {
    propertyValue: round2(input.propertyValue),
    downPayment: round2(input.downPayment),
    fgtsAmount: round2(input.fgtsAmount),
    financedAmount,
    termMonths,
    annualRatePct: input.annualRatePct,
    amortizationSystem: input.amortizationSystem,
    firstInstallment: round2(firstInstallment),
    lastInstallment: round2(lastInstallment),
    averageInstallment,
    totalInterest,
    scheduleSummary,
  };
}
