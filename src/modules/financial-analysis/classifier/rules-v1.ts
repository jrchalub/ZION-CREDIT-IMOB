import type { TransactionCategory } from "../constants";
import { CLASSIFIER_RULES_VERSION } from "../constants";

export type ClassifyInput = {
  description: string;
  direction: "CREDIT" | "DEBIT" | null;
  amount?: number;
  existingCategory?: string | null;
};

export type ClassifyResult = {
  category: TransactionCategory;
  confidence: number;
  ruleId: string | null;
  source: string;
};

type Rule = {
  id: string;
  category: TransactionCategory;
  confidence: number;
  direction?: "CREDIT" | "DEBIT";
  pattern: RegExp;
};

/**
 * Deterministic rules-v1 — versioned in code (FASE 5 may move to DB).
 */
const RULES_V1: Rule[] = [
  {
    id: "salary-credit",
    category: "SALARY",
    confidence: 0.95,
    direction: "CREDIT",
    pattern: /\b(salario|salário|folha|proventos|pagamento\s+de\s+salario)\b/i,
  },
  {
    id: "own-transfer-credit",
    category: "OWN_TRANSFER",
    confidence: 0.9,
    direction: "CREDIT",
    pattern:
      /\b(transferencia\s+propria|transferência\s+própria|entre\s+contas|mesma\s+titularidade|pix\s+enviado\s+por\s+mim)\b/i,
  },
  {
    id: "loan-credit",
    category: "LOAN",
    confidence: 0.92,
    direction: "CREDIT",
    pattern: /\b(emprestimo|empréstimo|credito\s+pessoal|crédito\s+pessoal|financiamento\s+recebido)\b/i,
  },
  {
    id: "refund-credit",
    category: "REFUND",
    confidence: 0.9,
    direction: "CREDIT",
    pattern: /\b(estorno|reembolso|devolucao|devolução|chargeback)\b/i,
  },
  {
    id: "income-probable-credit",
    category: "INCOME_PROBABLE",
    confidence: 0.8,
    direction: "CREDIT",
    pattern: /\b(pix\s+recebido|ted\s+recebida|doc\s+recebido|deposito|depósito|recebimento)\b/i,
  },
  {
    id: "card-payment-debit",
    category: "CARD_PAYMENT",
    confidence: 0.93,
    direction: "DEBIT",
    pattern: /\b(pagamento\s+fatura|fatura\s+(cartao|cartão)|cartao\s+de\s+credito|cartão\s+de\s+crédito|midway|nubank\s+cartao)\b/i,
  },
  {
    id: "fee-debit",
    category: "FEE",
    confidence: 0.9,
    direction: "DEBIT",
    pattern: /\b(tarifa|taxa\s+de\s+servico|taxa\s+de\s+serviço|iof|anuidade)\b/i,
  },
  {
    id: "expense-debit",
    category: "EXPENSE",
    confidence: 0.75,
    direction: "DEBIT",
    pattern: /\b(compra|pagamento|debito|débito|saque|pix\s+enviado)\b/i,
  },
];

const KNOWN: ReadonlySet<string> = new Set([
  "INCOME_PROBABLE",
  "SALARY",
  "OWN_TRANSFER",
  "LOAN",
  "REFUND",
  "CARD_PAYMENT",
  "EXPENSE",
  "FEE",
  "UNKNOWN",
]);

export function classifyTransaction(input: ClassifyInput): ClassifyResult {
  const description = input.description ?? "";
  const direction = input.direction;

  for (const rule of RULES_V1) {
    if (rule.direction && direction && rule.direction !== direction) continue;
    if (rule.pattern.test(description)) {
      return {
        category: rule.category,
        confidence: rule.confidence,
        ruleId: rule.id,
        source: CLASSIFIER_RULES_VERSION,
      };
    }
  }

  if (input.existingCategory && KNOWN.has(input.existingCategory)) {
    return {
      category: input.existingCategory as TransactionCategory,
      confidence: 0.7,
      ruleId: "existing-category",
      source: CLASSIFIER_RULES_VERSION,
    };
  }

  if (direction === "CREDIT") {
    return {
      category: "INCOME_PROBABLE",
      confidence: 0.55,
      ruleId: "default-credit",
      source: CLASSIFIER_RULES_VERSION,
    };
  }
  if (direction === "DEBIT") {
    return {
      category: "EXPENSE",
      confidence: 0.55,
      ruleId: "default-debit",
      source: CLASSIFIER_RULES_VERSION,
    };
  }

  return {
    category: "UNKNOWN",
    confidence: 0.4,
    ruleId: null,
    source: CLASSIFIER_RULES_VERSION,
  };
}
