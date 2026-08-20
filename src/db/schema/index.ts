import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "ADMIN",
  "GESTOR",
  "ANALISTA",
  "CORRESPONDENTE",
  "OPERADOR",
  "CLIENTE",
]);

export const incomeProfileEnum = pgEnum("income_profile", [
  "AUTONOMO",
  "CLT",
  "MEI",
  "EMPRESARIO",
  "SERVIDOR_PUBLICO",
  "APOSENTADO",
  "PENSIONISTA",
  "COMPOSICAO_RENDA",
  "SOCIO_EMPRESA",
  "PRODUTOR_RURAL",
]);

export const maritalStatusEnum = pgEnum("marital_status", [
  "SOLTEIRO",
  "CASADO",
  "DIVORCIADO",
  "VIUVO",
  "UNIAO_ESTAVEL",
  "SEPARADO",
]);

export const processStatusEnum = pgEnum("process_status", [
  "NOVO",
  "DOCUMENTACAO_PENDENTE",
  "DOCUMENTACAO_RECEBIDA",
  "EM_TRIAGEM",
  "EM_ANALISE",
  "PENDENCIA_ANALISTA",
  "PRE_ANALISADO",
  "APTO",
  "NAO_APTO",
  "AGUARDANDO_CLIENTE",
  "AGUARDANDO_BANCO",
  "ENVIADO_AO_BANCO",
  "APROVADO",
  "REPROVADO",
  "CONTRATADO",
  "CANCELADO",
]);

export const amortizationSystemEnum = pgEnum("amortization_system", [
  "SAC",
  "PRICE",
]);

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  document: text("document"),
  active: boolean("active").notNull().default(true),
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    role: userRoleEnum("role").notNull(),
    phone: text("phone"),
    active: boolean("active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_tenant_email_uidx").on(table.tenantId, table.email),
    index("users_tenant_idx").on(table.tenantId),
    index("users_role_idx").on(table.role),
  ],
);

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    cpf: text("cpf").notNull(),
    rg: text("rg"),
    birthDate: date("birth_date"),
    maritalStatus: maritalStatusEnum("marital_status"),
    nationality: text("nationality").default("Brasileira"),
    profession: text("profession"),
    occupationType: text("occupation_type"),
    activityStartDate: date("activity_start_date"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    email: text("email"),
    declaredIncome: numeric("declared_income", { precision: 14, scale: 2 }),
    fgtsBalance: numeric("fgts_balance", { precision: 14, scale: 2 }),
    downPaymentAvailable: numeric("down_payment_available", { precision: 14, scale: 2 }),
    primaryBank: text("primary_bank"),
    bankAccount: text("bank_account"),
    overdraftLimit: numeric("overdraft_limit", { precision: 14, scale: 2 }),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("clients_tenant_cpf_uidx").on(table.tenantId, table.cpf),
    index("clients_tenant_idx").on(table.tenantId),
    index("clients_full_name_idx").on(table.fullName),
  ],
);

export const clientAddresses = pgTable(
  "client_addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    street: text("street").notNull(),
    number: text("number"),
    complement: text("complement"),
    neighborhood: text("neighborhood"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    zipCode: text("zip_code").notNull(),
    isPrimary: boolean("is_primary").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("client_addresses_client_idx").on(table.clientId),
    index("client_addresses_tenant_idx").on(table.tenantId),
  ],
);

export const correspondents = pgTable(
  "correspondents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    companyName: text("company_name").notNull(),
    cnpj: text("cnpj"),
    responsibleName: text("responsible_name"),
    phone: text("phone"),
    email: text("email"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("correspondents_tenant_idx").on(table.tenantId)],
);

export const developments = pgTable(
  "developments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    developer: text("developer"),
    builder: text("builder"),
    street: text("street"),
    city: text("city"),
    state: text("state"),
    minValue: numeric("min_value", { precision: 14, scale: 2 }),
    maxValue: numeric("max_value", { precision: 14, scale: 2 }),
    status: text("status").notNull().default("ATIVO"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("developments_tenant_idx").on(table.tenantId)],
);

export const units = pgTable(
  "units",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    developmentId: uuid("development_id")
      .notNull()
      .references(() => developments.id, { onDelete: "cascade" }),
    block: text("block"),
    unitNumber: text("unit_number").notNull(),
    floor: integer("floor"),
    areaM2: numeric("area_m2", { precision: 10, scale: 2 }),
    bedrooms: integer("bedrooms"),
    parkingSpaces: integer("parking_spaces"),
    value: numeric("value", { precision: 14, scale: 2 }),
    status: text("status").notNull().default("DISPONIVEL"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("units_tenant_idx").on(table.tenantId),
    index("units_development_idx").on(table.developmentId),
  ],
);

export const financingProcesses = pgTable(
  "financing_processes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processNumber: text("process_number").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    incomeProfile: incomeProfileEnum("income_profile").notNull(),
    correspondentId: uuid("correspondent_id").references(() => correspondents.id),
    analystId: uuid("analyst_id").references(() => users.id),
    developmentId: uuid("development_id").references(() => developments.id),
    unitId: uuid("unit_id").references(() => units.id),
    intendedBank: text("intended_bank"),
    propertyValue: numeric("property_value", { precision: 14, scale: 2 }),
    downPayment: numeric("down_payment", { precision: 14, scale: 2 }),
    financedAmount: numeric("financed_amount", { precision: 14, scale: 2 }),
    fgtsAmount: numeric("fgts_amount", { precision: 14, scale: 2 }),
    amortizationSystem: amortizationSystemEnum("amortization_system"),
    financingType: text("financing_type"),
    status: processStatusEnum("status").notNull().default("NOVO"),
    internalScore: integer("internal_score"),
    analyzedIncome: numeric("analyzed_income", { precision: 14, scale: 2 }),
    paymentCapacity: numeric("payment_capacity", { precision: 14, scale: 2 }),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    lastMovedAt: timestamp("last_moved_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("processes_tenant_number_uidx").on(table.tenantId, table.processNumber),
    index("processes_tenant_idx").on(table.tenantId),
    index("processes_status_idx").on(table.status),
    index("processes_client_idx").on(table.clientId),
    index("processes_analyst_idx").on(table.analystId),
  ],
);

export const processStatusHistory = pgTable(
  "process_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => financingProcesses.id, { onDelete: "cascade" }),
    fromStatus: processStatusEnum("from_status"),
    toStatus: processStatusEnum("to_status").notNull(),
    reason: text("reason"),
    changedByUserId: uuid("changed_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("process_status_history_process_idx").on(table.processId),
    index("process_status_history_tenant_idx").on(table.tenantId),
  ],
);

export const processNumberSequences = pgTable(
  "process_number_sequences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    lastNumber: integer("last_number").notNull().default(0),
  },
  (table) => [
    uniqueIndex("process_sequences_tenant_year_uidx").on(table.tenantId, table.year),
  ],
);

/**
 * Audit logs store redacted payloads only.
 * Never persist full CPF, full account numbers, or document contents.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    oldValue: jsonb("old_value").$type<Record<string, unknown> | null>(),
    newValue: jsonb("new_value").$type<Record<string, unknown> | null>(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    correlationId: text("correlation_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_tenant_idx").on(table.tenantId),
    index("audit_logs_entity_idx").on(table.entity, table.entityId),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
);

export const documentStatusEnum = pgEnum("document_status", [
  "PENDENTE",
  "RECEBIDO",
  "PROCESSANDO",
  "VALIDADO",
  "REJEITADO",
  "EXPIRADO",
]);

export const checklistItemStatusEnum = pgEnum("checklist_item_status", [
  "PENDENTE",
  "ENVIADO",
  "VALIDADO",
  "REJEITADO",
  "NAO_APLICAVEL",
]);

export const checklistRequirementEnum = pgEnum("checklist_requirement", [
  "OBRIGATORIO",
  "CONDICIONAL",
  "OPCIONAL",
]);

export const pendencyPriorityEnum = pgEnum("pendency_priority", [
  "BAIXA",
  "MEDIA",
  "ALTA",
  "CRITICA",
]);

export const pendencyStatusEnum = pgEnum("pendency_status", [
  "ABERTA",
  "EM_ANDAMENTO",
  "RESOLVIDA",
  "CANCELADA",
]);

export const documentTypes = pgTable(
  "document_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category").notNull().default("GERAL"),
    allowsMultiple: boolean("allows_multiple").notNull().default(false),
    requiresCompetence: boolean("requires_competence").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const incomeProfileDocumentRequirements = pgTable(
  "income_profile_document_requirements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    incomeProfile: incomeProfileEnum("income_profile").notNull(),
    documentTypeId: uuid("document_type_id")
      .notNull()
      .references(() => documentTypes.id, { onDelete: "cascade" }),
    requirement: checklistRequirementEnum("requirement").notNull().default("OBRIGATORIO"),
    quantity: integer("quantity").notNull().default(1),
    labelTemplate: text("label_template"),
    sortOrder: integer("sort_order").notNull().default(0),
    conditionKey: text("condition_key"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("profile_doc_req_profile_idx").on(table.incomeProfile),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => financingProcesses.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    documentTypeId: uuid("document_type_id")
      .notNull()
      .references(() => documentTypes.id, { onDelete: "restrict" }),
    checklistItemId: uuid("checklist_item_id"),
    originalFilename: text("original_filename").notNull(),
    internalFilename: text("internal_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    extension: text("extension").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    contentHash: text("content_hash").notNull(),
    storageProvider: text("storage_provider").notNull().default("minio"),
    storageKey: text("storage_key").notNull(),
    status: documentStatusEnum("status").notNull().default("RECEBIDO"),
    pageCount: integer("page_count"),
    documentDate: date("document_date"),
    competence: text("competence"),
    validUntil: date("valid_until"),
    classificationConfidence: numeric("classification_confidence", {
      precision: 5,
      scale: 4,
    }),
    extractionConfidence: numeric("extraction_confidence", {
      precision: 5,
      scale: 4,
    }),
    rejectionReason: text("rejection_reason"),
    validatedByUserId: uuid("validated_by_user_id").references(() => users.id),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id),
    duplicateOfDocumentId: uuid("duplicate_of_document_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("documents_tenant_idx").on(table.tenantId),
    index("documents_process_idx").on(table.processId),
    index("documents_client_idx").on(table.clientId),
    index("documents_hash_idx").on(table.tenantId, table.contentHash),
    index("documents_status_idx").on(table.status),
  ],
);

export const processChecklistItems = pgTable(
  "process_checklist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => financingProcesses.id, { onDelete: "cascade" }),
    documentTypeId: uuid("document_type_id")
      .notNull()
      .references(() => documentTypes.id, { onDelete: "restrict" }),
    label: text("label").notNull(),
    requirement: checklistRequirementEnum("requirement").notNull(),
    status: checklistItemStatusEnum("status").notNull().default("PENDENTE"),
    sortOrder: integer("sort_order").notNull().default(0),
    competence: text("competence"),
    conditionKey: text("condition_key"),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("checklist_process_idx").on(table.processId),
    index("checklist_tenant_idx").on(table.tenantId),
  ],
);

export const pendencies = pgTable(
  "pendencies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => financingProcesses.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    checklistItemId: uuid("checklist_item_id").references(
      () => processChecklistItems.id,
      { onDelete: "set null" },
    ),
    type: text("type").notNull(),
    description: text("description").notNull(),
    priority: pendencyPriorityEnum("priority").notNull().default("MEDIA"),
    status: pendencyStatusEnum("status").notNull().default("ABERTA"),
    idempotencyKey: text("idempotency_key"),
    assigneeUserId: uuid("assignee_user_id").references(() => users.id),
    dueAt: timestamp("due_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("pendencies_tenant_idx").on(table.tenantId),
    index("pendencies_process_idx").on(table.processId),
    index("pendencies_status_idx").on(table.status),
    uniqueIndex("pendencies_idempotency_uidx").on(table.tenantId, table.idempotencyKey),
  ],
);

/**
 * FASE 3 — Document Intelligence
 * processing_runs.status = estado do pipeline OCR/IA
 * documents.status = ciclo de vida documental (VALIDADO só por humano)
 */
export const documentProcessingRunStatusEnum = pgEnum(
  "document_processing_run_status",
  [
    "PENDING",
    "QUEUED",
    "PROCESSING",
    "OCR_PROCESSING",
    "CLASSIFYING",
    "EXTRACTING",
    "VALIDATING",
    "COMPLETED",
    "REQUIRES_REVIEW",
    "FAILED",
  ],
);

export const documentProcessingRuns = pgTable(
  "document_processing_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => financingProcesses.id, { onDelete: "cascade" }),
    status: documentProcessingRunStatusEnum("status").notNull().default("PENDING"),
    correlationId: text("correlation_id"),
    jobId: text("job_id"),
    attemptCount: integer("attempt_count").notNull().default(0),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("doc_proc_runs_document_idx").on(table.documentId),
    index("doc_proc_runs_tenant_idx").on(table.tenantId),
    index("doc_proc_runs_status_idx").on(table.status),
    uniqueIndex("doc_proc_runs_job_uidx").on(table.jobId),
  ],
);

export const documentOcrResults = pgTable(
  "document_ocr_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    processingRunId: uuid("processing_run_id").references(
      () => documentProcessingRuns.id,
      { onDelete: "set null" },
    ),
    provider: text("provider").notNull(),
    providerVersion: text("provider_version"),
    text: text("text").notNull(),
    pages: integer("pages"),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    processingTimeMs: integer("processing_time_ms"),
    method: text("method").notNull().default("ocr"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("doc_ocr_document_idx").on(table.documentId),
    index("doc_ocr_run_idx").on(table.processingRunId),
  ],
);

export const documentClassifications = pgTable(
  "document_classifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    processingRunId: uuid("processing_run_id").references(
      () => documentProcessingRuns.id,
      { onDelete: "set null" },
    ),
    suggestedTypeCode: text("suggested_type_code").notNull(),
    matchedDocumentTypeId: uuid("matched_document_type_id").references(
      () => documentTypes.id,
    ),
    confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull(),
    decision: text("decision").notNull(),
    provider: text("provider").notNull(),
    model: text("model"),
    promptVersion: text("prompt_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("doc_class_document_idx").on(table.documentId)],
);

export const documentExtractedFields = pgTable(
  "document_extracted_fields",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    processingRunId: uuid("processing_run_id").references(
      () => documentProcessingRuns.id,
      { onDelete: "set null" },
    ),
    field: text("field").notNull(),
    value: text("value"),
    normalizedValue: text("normalized_value"),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    page: integer("page"),
    evidenceText: text("evidence_text"),
    boundingBox: jsonb("bounding_box").$type<Record<string, unknown> | null>(),
    provider: text("provider").notNull(),
    model: text("model"),
    promptVersion: text("prompt_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("doc_extracted_document_idx").on(table.documentId),
    index("doc_extracted_field_idx").on(table.documentId, table.field),
  ],
);

export const documentFieldCorrections = pgTable(
  "document_field_corrections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    extractedFieldId: uuid("extracted_field_id").references(
      () => documentExtractedFields.id,
      { onDelete: "set null" },
    ),
    field: text("field").notNull(),
    aiValue: text("ai_value"),
    correctedValue: text("corrected_value").notNull(),
    reason: text("reason"),
    correctedByUserId: uuid("corrected_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("doc_field_corr_document_idx").on(table.documentId)],
);

export const documentConsistencyChecks = pgTable(
  "document_consistency_checks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => financingProcesses.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    processingRunId: uuid("processing_run_id").references(
      () => documentProcessingRuns.id,
      { onDelete: "set null" },
    ),
    consistencyScore: integer("consistency_score"),
    issues: jsonb("issues")
      .$type<Array<{ type: string; message: string; confidence?: number }>>()
      .default([]),
    factors: jsonb("factors")
      .$type<Array<{ label: string; positive: boolean }>>()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("doc_consistency_process_idx").on(table.processId),
    index("doc_consistency_document_idx").on(table.documentId),
  ],
);

export const bankStatements = pgTable(
  "bank_statements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    processingRunId: uuid("processing_run_id").references(
      () => documentProcessingRuns.id,
      { onDelete: "set null" },
    ),
    holderName: text("holder_name"),
    holderCpfMasked: text("holder_cpf_masked"),
    bankName: text("bank_name"),
    agency: text("agency"),
    accountMasked: text("account_masked"),
    periodStart: text("period_start"),
    periodEnd: text("period_end"),
    openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }),
    closingBalance: numeric("closing_balance", { precision: 14, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("bank_statements_document_idx").on(table.documentId)],
);

export const bankTransactionDirectionEnum = pgEnum("bank_transaction_direction", [
  "CREDIT",
  "DEBIT",
]);

export const bankTransactions = pgTable(
  "bank_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    bankStatementId: uuid("bank_statement_id")
      .notNull()
      .references(() => bankStatements.id, { onDelete: "cascade" }),
    transactionDate: text("transaction_date"),
    description: text("description"),
    amount: numeric("amount", { precision: 14, scale: 2 }),
    direction: bankTransactionDirectionEnum("direction"),
    balance: numeric("balance", { precision: 14, scale: 2 }),
    category: text("category").notNull().default("UNKNOWN"),
    classificationConfidence: numeric("classification_confidence", {
      precision: 5,
      scale: 4,
    }),
    evidencePage: integer("evidence_page"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("bank_tx_statement_idx").on(table.bankStatementId)],
);

export const aiRequests = pgTable(
  "ai_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    processingRunId: uuid("processing_run_id").references(
      () => documentProcessingRuns.id,
      { onDelete: "set null" },
    ),
    provider: text("provider").notNull(),
    model: text("model"),
    operation: text("operation").notNull(),
    promptVersion: text("prompt_version"),
    requestHash: text("request_hash"),
    status: text("status").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    estimatedCost: numeric("estimated_cost", { precision: 12, scale: 6 }),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_requests_tenant_idx").on(table.tenantId),
    index("ai_requests_document_idx").on(table.documentId),
  ],
);

export const aiResponses = pgTable(
  "ai_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    aiRequestId: uuid("ai_request_id")
      .notNull()
      .references(() => aiRequests.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    /** Redacted/summary payload for audit — avoid full PII dumps */
    summary: jsonb("summary").$type<Record<string, unknown>>().default({}),
    rawValid: boolean("raw_valid").notNull().default(true),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_responses_request_idx").on(table.aiRequestId)],
);

/**
 * FASE 4 — Financial Analysis
 * Consumes structured bank data from FASE 3. Never approves credit.
 */
export const financialAnalysisStatusEnum = pgEnum("financial_analysis_status", [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
]);

export const financialIndicativeEnum = pgEnum("financial_indicative", [
  "FAVORAVEL",
  "NECESSITA_ANALISE",
  "DESFAVORAVEL",
]);

export const transactionCategoryEnum = pgEnum("transaction_category", [
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

export const financialAnalyses = pgTable(
  "financial_analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => financingProcesses.id, { onDelete: "cascade" }),
    status: financialAnalysisStatusEnum("status").notNull().default("PENDING"),
    methodVersion: text("method_version").notNull().default("income-v1"),
    ruleVersion: text("rule_version").notNull().default("rules-v1"),
    indicative: financialIndicativeEnum("indicative"),
    disclaimer: text("disclaimer").notNull(),
    summary: jsonb("summary").$type<Record<string, unknown>>().default({}),
    errorMessage: text("error_message"),
    correlationId: text("correlation_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fin_analyses_process_idx").on(table.processId),
    index("fin_analyses_tenant_idx").on(table.tenantId),
  ],
);

export const incomeAnalyses = pgTable(
  "income_analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => financingProcesses.id, { onDelete: "cascade" }),
    financialAnalysisId: uuid("financial_analysis_id")
      .notNull()
      .references(() => financialAnalyses.id, { onDelete: "cascade" }),
    declaredIncome: numeric("declared_income", { precision: 14, scale: 2 }),
    estimatedIncome: numeric("estimated_income", { precision: 14, scale: 2 }),
    meanIncome: numeric("mean_income", { precision: 14, scale: 2 }),
    medianIncome: numeric("median_income", { precision: 14, scale: 2 }),
    minIncome: numeric("min_income", { precision: 14, scale: 2 }),
    maxIncome: numeric("max_income", { precision: 14, scale: 2 }),
    variationPct: numeric("variation_pct", { precision: 8, scale: 4 }),
    recurrenceScore: numeric("recurrence_score", { precision: 5, scale: 4 }),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    monthsAnalyzed: integer("months_analyzed").notNull().default(0),
    methodVersion: text("method_version").notNull().default("income-v1"),
    exclusions: jsonb("exclusions")
      .$type<Array<{ category: string; amount: number; month?: string }>>()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("income_analyses_process_idx").on(table.processId),
    index("income_analyses_fin_idx").on(table.financialAnalysisId),
  ],
);

export const incomeMonthRolls = pgTable(
  "income_month_rolls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => financingProcesses.id, { onDelete: "cascade" }),
    financialAnalysisId: uuid("financial_analysis_id")
      .notNull()
      .references(() => financialAnalyses.id, { onDelete: "cascade" }),
    bankStatementId: uuid("bank_statement_id").references(() => bankStatements.id, {
      onDelete: "set null",
    }),
    yearMonth: text("year_month").notNull(),
    periodStart: text("period_start"),
    periodEnd: text("period_end"),
    grossCredits: numeric("gross_credits", { precision: 14, scale: 2 }).notNull(),
    ownTransfers: numeric("own_transfers", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    loans: numeric("loans", { precision: 14, scale: 2 }).notNull().default("0"),
    refunds: numeric("refunds", { precision: 14, scale: 2 }).notNull().default("0"),
    otherExclusions: numeric("other_exclusions", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    validCredits: numeric("valid_credits", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("income_month_rolls_fin_idx").on(table.financialAnalysisId),
    index("income_month_rolls_process_idx").on(table.processId),
  ],
);

export const transactionClassifications = pgTable(
  "transaction_classifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    bankTransactionId: uuid("bank_transaction_id")
      .notNull()
      .references(() => bankTransactions.id, { onDelete: "cascade" }),
    category: transactionCategoryEnum("category").notNull(),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    source: text("source").notNull().default("rules-v1"),
    ruleId: text("rule_id"),
    overridden: boolean("overridden").notNull().default(false),
    previousCategory: text("previous_category"),
    overriddenByUserId: uuid("overridden_by_user_id").references(() => users.id),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("tx_class_tx_uidx").on(table.bankTransactionId),
    index("tx_class_tenant_idx").on(table.tenantId),
  ],
);

export const creditCardAnalyses = pgTable(
  "credit_card_analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => financingProcesses.id, { onDelete: "cascade" }),
    financialAnalysisId: uuid("financial_analysis_id")
      .notNull()
      .references(() => financialAnalyses.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    issuer: text("issuer"),
    creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }),
    availableLimit: numeric("available_limit", { precision: 14, scale: 2 }),
    invoiceAmount: numeric("invoice_amount", { precision: 14, scale: 2 }),
    installmentsTotal: numeric("installments_total", { precision: 14, scale: 2 }),
    monthlyCommitment: numeric("monthly_commitment", { precision: 14, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("credit_card_analyses_fin_idx").on(table.financialAnalysisId)],
);

export const debts = pgTable(
  "debts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => financingProcesses.id, { onDelete: "cascade" }),
    financialAnalysisId: uuid("financial_analysis_id").references(
      () => financialAnalyses.id,
      { onDelete: "set null" },
    ),
    type: text("type").notNull(),
    creditor: text("creditor"),
    description: text("description"),
    outstandingBalance: numeric("outstanding_balance", { precision: 14, scale: 2 }),
    monthlyInstallment: numeric("monthly_installment", { precision: 14, scale: 2 }),
    source: text("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("debts_process_idx").on(table.processId)],
);

export const financialCommitments = pgTable(
  "financial_commitments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => financingProcesses.id, { onDelete: "cascade" }),
    financialAnalysisId: uuid("financial_analysis_id")
      .notNull()
      .references(() => financialAnalyses.id, { onDelete: "cascade" }),
    rent: numeric("rent", { precision: 14, scale: 2 }).notNull().default("0"),
    debtsTotal: numeric("debts_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    cardsTotal: numeric("cards_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    otherCommitments: numeric("other_commitments", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    totalCommitments: numeric("total_commitments", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("fin_commitments_fin_idx").on(table.financialAnalysisId)],
);

export const financingSimulations = pgTable(
  "financing_simulations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => financingProcesses.id, { onDelete: "cascade" }),
    financialAnalysisId: uuid("financial_analysis_id").references(
      () => financialAnalyses.id,
      { onDelete: "set null" },
    ),
    propertyValue: numeric("property_value", { precision: 14, scale: 2 }).notNull(),
    downPayment: numeric("down_payment", { precision: 14, scale: 2 }).notNull(),
    fgtsAmount: numeric("fgts_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    financedAmount: numeric("financed_amount", { precision: 14, scale: 2 }).notNull(),
    termMonths: integer("term_months").notNull(),
    annualRatePct: numeric("annual_rate_pct", { precision: 8, scale: 4 }).notNull(),
    amortizationSystem: amortizationSystemEnum("amortization_system").notNull(),
    firstInstallment: numeric("first_installment", { precision: 14, scale: 2 }),
    lastInstallment: numeric("last_installment", { precision: 14, scale: 2 }),
    averageInstallment: numeric("average_installment", { precision: 14, scale: 2 }),
    totalInterest: numeric("total_interest", { precision: 14, scale: 2 }),
    scheduleSummary: jsonb("schedule_summary")
      .$type<Array<{ n: number; installment: number; interest: number; amortization: number; balance: number }>>()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("fin_simulations_process_idx").on(table.processId)],
);

export const paymentCapacitySnapshots = pgTable(
  "payment_capacity_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => financingProcesses.id, { onDelete: "cascade" }),
    financialAnalysisId: uuid("financial_analysis_id")
      .notNull()
      .references(() => financialAnalyses.id, { onDelete: "cascade" }),
    analyzedIncome: numeric("analyzed_income", { precision: 14, scale: 2 }),
    totalCommitments: numeric("total_commitments", { precision: 14, scale: 2 }),
    simulatedInstallment: numeric("simulated_installment", { precision: 14, scale: 2 }),
    estimatedCapacity: numeric("estimated_capacity", { precision: 14, scale: 2 }),
    commitmentPct: numeric("commitment_pct", { precision: 8, scale: 4 }),
    indicative: financialIndicativeEnum("indicative").notNull(),
    flags: jsonb("flags").$type<string[]>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("pay_capacity_fin_idx").on(table.financialAnalysisId)],
);

/**
 * Append-only immutable snapshot per analysis run.
 * NEVER update rows — ruleVersion changes must not rewrite history.
 */
export const financialAnalysisSnapshots = pgTable(
  "financial_analysis_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => financingProcesses.id, { onDelete: "cascade" }),
    financialAnalysisId: uuid("financial_analysis_id")
      .notNull()
      .references(() => financialAnalyses.id, { onDelete: "cascade" }),
    ruleVersion: text("rule_version").notNull(),
    incomeMethodVersion: text("income_method_version").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fin_analysis_snapshots_analysis_uidx").on(table.financialAnalysisId),
    index("fin_analysis_snapshots_process_idx").on(table.processId),
  ],
);

/**
 * FASE 5 — Credit Decision Support
 * Immutable decision support snapshots + explainable factors + analyst reviews.
 * Never a black-box score. Never auto-approves credit.
 */
export const decisionSupportIndicativeEnum = pgEnum(
  "decision_support_indicative",
  ["FAVORAVEL", "REQUER_ANALISE", "DESFAVORAVEL"],
);

export const decisionFactorKindEnum = pgEnum("decision_factor_kind", [
  "POSITIVO",
  "ATENCAO",
  "PENDENCIA",
]);

export const decisionFactorSeverityEnum = pgEnum("decision_factor_severity", [
  "INFO",
  "OK",
  "ATENCAO",
  "CRITICO",
]);

export const matrixResultEnum = pgEnum("matrix_result", [
  "OK",
  "ATENCAO",
  "CRITICO",
  "NA",
]);

export const analystReviewStatusEnum = pgEnum("analyst_review_status", [
  "PENDING",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "RETURNED",
]);

export const decisionSupportSnapshots = pgTable(
  "decision_support_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => financingProcesses.id, { onDelete: "cascade" }),
    financialSnapshotId: uuid("financial_snapshot_id").references(
      () => financialAnalysisSnapshots.id,
      { onDelete: "set null" },
    ),
    version: text("version").notNull().default("credit-support-v1"),
    rulesVersion: text("rules_version").notNull().default("credit-support-v1"),
    indicativeResult: decisionSupportIndicativeEnum("indicative_result").notNull(),
    contentHash: text("content_hash").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    matrix: jsonb("matrix")
      .$type<Array<{ category: string; result: string; label: string }>>()
      .default([]),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("decision_support_snapshots_process_idx").on(table.processId),
    index("decision_support_snapshots_tenant_idx").on(table.tenantId),
  ],
);

export const decisionFactors = pgTable(
  "decision_factors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => financingProcesses.id, { onDelete: "cascade" }),
    decisionSupportSnapshotId: uuid("decision_support_snapshot_id")
      .notNull()
      .references(() => decisionSupportSnapshots.id, { onDelete: "cascade" }),
    kind: decisionFactorKindEnum("kind").notNull(),
    code: text("code").notNull(),
    description: text("description").notNull(),
    severity: decisionFactorSeverityEnum("severity").notNull().default("INFO"),
    category: text("category").notNull(),
    /** Provenance chain for auditability */
    originType: text("origin_type").notNull(),
    originId: text("origin_id"),
    originLabel: text("origin_label"),
    evidence: jsonb("evidence")
      .$type<{
        documentId?: string;
        page?: number;
        evidenceText?: string;
        financialSnapshotId?: string;
        field?: string;
        path?: string[];
      }>()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("decision_factors_snapshot_idx").on(table.decisionSupportSnapshotId),
    index("decision_factors_process_idx").on(table.processId),
    index("decision_factors_code_idx").on(table.code),
  ],
);

export const creditAnalystReviews = pgTable(
  "credit_analyst_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => financingProcesses.id, { onDelete: "cascade" }),
    decisionSupportSnapshotId: uuid("decision_support_snapshot_id")
      .notNull()
      .references(() => decisionSupportSnapshots.id, { onDelete: "restrict" }),
    financialSnapshotId: uuid("financial_snapshot_id").references(
      () => financialAnalysisSnapshots.id,
      { onDelete: "set null" },
    ),
    status: analystReviewStatusEnum("status").notNull().default("PENDING"),
    analystId: uuid("analyst_id").references(() => users.id),
    decision: text("decision"),
    justification: text("justification"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("credit_analyst_reviews_process_idx").on(table.processId),
    index("credit_analyst_reviews_status_idx").on(table.status),
    index("credit_analyst_reviews_snapshot_idx").on(table.decisionSupportSnapshotId),
  ],
);
