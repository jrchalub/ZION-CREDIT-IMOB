import type {
  ClassificationInput,
  ClassificationResult,
  DocumentAIProvider,
  ExtractedField,
  ExtractionInput,
  ExtractionResult,
  MockAiScenario,
} from "./DocumentAIProvider";
import { PROMPT_VERSIONS } from "../prompts/versions";

function scenarioFromEnv(filename: string): MockAiScenario {
  const forced = (process.env.MOCK_AI_SCENARIO ?? "").toUpperCase() as MockAiScenario;
  const allowed: MockAiScenario[] = [
    "SUCCESS",
    "LOW_CONFIDENCE",
    "NAME_MISMATCH",
    "CPF_MISMATCH",
    "INVALID_JSON",
    "PROVIDER_ERROR",
    "OCR_ERROR",
  ];
  if (allowed.includes(forced)) return forced;

  const lower = filename.toLowerCase();
  if (lower.includes("lowconf")) return "LOW_CONFIDENCE";
  if (lower.includes("namemismatch")) return "NAME_MISMATCH";
  if (lower.includes("cpfmismatch")) return "CPF_MISMATCH";
  if (lower.includes("invalidjson")) return "INVALID_JSON";
  if (lower.includes("providererror")) return "PROVIDER_ERROR";
  if (lower.includes("ocrerror")) return "OCR_ERROR";
  return "SUCCESS";
}

function inferTypeFromName(filename: string, known: string[]): string {
  const lower = filename.toLowerCase();
  const map: Array<[RegExp, string]> = [
    [/extrato|bank|nubank/, "EXTRATO_BANCARIO"],
    [/fatura|cartao|midway/, "FATURA_CARTAO"],
    [/contracheque|holerite|payroll/, "CONTRACHEQUE"],
    [/ctps/, "CTPS_DIGITAL"],
    [/endereco|comprovante/, "COMPROVANTE_ENDERECO"],
    [/certidao|casamento|nascimento/, "CERTIDAO_ESTADO_CIVIL"],
    [/rg|identidade/, "RG_CPF"],
    [/cpf/, "RG_CPF"],
  ];
  for (const [re, code] of map) {
    if (re.test(lower) && known.includes(code)) return code;
  }
  return known.includes("EXTRATO_BANCARIO")
    ? "EXTRATO_BANCARIO"
    : known[0] ?? "OUTRO";
}

/**
 * Controllable mock for reproducible Phase 3 tests without external AI cost.
 */
export class MockDocumentAIProvider implements DocumentAIProvider {
  readonly name = "mock";

  constructor(private readonly forcedScenario?: MockAiScenario) {}

  private scenario(filename: string): MockAiScenario {
    return this.forcedScenario ?? scenarioFromEnv(filename);
  }

  async classify(input: ClassificationInput): Promise<ClassificationResult> {
    const scenario = this.scenario(input.filename);
    if (scenario === "PROVIDER_ERROR") {
      throw new Error("MOCK_PROVIDER_ERROR");
    }
    if (scenario === "INVALID_JSON") {
      // Simulate schema failure downstream by returning invalid type token
      return {
        documentType: "__INVALID__",
        confidence: 0.99,
        provider: this.name,
        model: "mock-v1",
        promptVersion: PROMPT_VERSIONS.classification,
      };
    }

    const documentType = inferTypeFromName(input.filename, input.knownTypeCodes);
    const confidence =
      scenario === "LOW_CONFIDENCE"
        ? 0.55
        : scenario === "NAME_MISMATCH" || scenario === "CPF_MISMATCH"
          ? 0.92
          : 0.97;

    return {
      documentType,
      confidence,
      provider: this.name,
      model: "mock-v1",
      promptVersion: PROMPT_VERSIONS.classification,
    };
  }

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const scenario = this.scenario(input.filename);
    if (scenario === "PROVIDER_ERROR") {
      throw new Error("MOCK_PROVIDER_ERROR");
    }
    if (scenario === "INVALID_JSON") {
      throw new Error("MOCK_INVALID_JSON");
    }

    const name =
      scenario === "NAME_MISMATCH"
        ? "Ana Paula Silva"
        : "Ana Paula Martins Santos";
    const cpf =
      scenario === "CPF_MISMATCH" ? "12345678901" : "52998224725";

    const baseConfidence = scenario === "LOW_CONFIDENCE" ? 0.62 : 0.98;
    const promptVersion =
      input.documentType === "EXTRATO_BANCARIO"
        ? PROMPT_VERSIONS.bankStatementExtraction
        : input.documentType === "CONTRACHEQUE"
          ? PROMPT_VERSIONS.payrollExtraction
          : input.documentType === "FATURA_CARTAO"
            ? PROMPT_VERSIONS.creditCardExtraction
            : input.documentType === "CTPS_DIGITAL"
              ? PROMPT_VERSIONS.ctpsExtraction
              : input.documentType === "COMPROVANTE_ENDERECO"
                ? PROMPT_VERSIONS.addressExtraction
                : PROMPT_VERSIONS.rgExtraction;

    const fields: ExtractedField[] = [
      {
        field: "full_name",
        value: name,
        normalizedValue: name.toUpperCase(),
        confidence: baseConfidence,
        page: 1,
        evidenceText: name,
        boundingBox: { x: 40, y: 80, width: 220, height: 18 },
      },
      {
        field: "cpf",
        value: cpf,
        normalizedValue: cpf,
        confidence: Math.min(0.99, baseConfidence + 0.01),
        page: 1,
        evidenceText: cpf,
        boundingBox: { x: 40, y: 110, width: 140, height: 16 },
      },
    ];

    const extras: Record<string, unknown> = {};

    if (input.documentType === "EXTRATO_BANCARIO") {
      fields.push(
        {
          field: "bank_name",
          value: "Nubank",
          normalizedValue: "NUBANK",
          confidence: baseConfidence,
          page: 1,
          evidenceText: "Nubank",
          boundingBox: { x: 40, y: 40, width: 80, height: 14 },
        },
        {
          field: "period_start",
          value: "2026-05-01",
          normalizedValue: "2026-05-01",
          confidence: baseConfidence,
          page: 1,
          evidenceText: "01/05/2026",
          boundingBox: null,
        },
        {
          field: "period_end",
          value: "2026-05-31",
          normalizedValue: "2026-05-31",
          confidence: baseConfidence,
          page: 1,
          evidenceText: "31/05/2026",
          boundingBox: null,
        },
      );
      extras.transactions = [
        {
          transactionDate: "2026-05-05",
          description: "PIX Recebido Costura",
          amount: "2550.00",
          direction: "CREDIT",
          category: "INCOME_PROBABLE",
          classificationConfidence: 0.88,
          evidencePage: 1,
        },
        {
          transactionDate: "2026-05-10",
          description: "Pagamento fatura Midway",
          amount: "420.00",
          direction: "DEBIT",
          category: "CARD_PAYMENT",
          classificationConfidence: 0.91,
          evidencePage: 1,
        },
      ];
      // Explicit: no income estimation here (FASE 4)
      extras.incomeAnalysis = null;
    }

    if (input.documentType === "COMPROVANTE_ENDERECO") {
      fields.push(
        {
          field: "street",
          value: "Rua das Acácias",
          normalizedValue: "RUA DAS ACACIAS",
          confidence: baseConfidence,
          page: 1,
          evidenceText: "Rua das Acácias",
          boundingBox: null,
        },
        {
          field: "city",
          value: "São Paulo",
          normalizedValue: "SAO PAULO",
          confidence: baseConfidence,
          page: 1,
          evidenceText: "São Paulo",
          boundingBox: null,
        },
        {
          field: "state",
          value: "SP",
          normalizedValue: "SP",
          confidence: baseConfidence,
          page: 1,
          evidenceText: "SP",
          boundingBox: null,
        },
        {
          field: "zip_code",
          value: "01310100",
          normalizedValue: "01310100",
          confidence: baseConfidence,
          page: 1,
          evidenceText: "01310-100",
          boundingBox: null,
        },
      );
    }

    return {
      fields,
      extras,
      provider: this.name,
      model: "mock-v1",
      promptVersion,
    };
  }
}
