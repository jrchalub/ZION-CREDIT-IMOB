import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import {
  clientAddresses,
  clients,
  correspondents,
  developments,
  documentTypes,
  financingProcesses,
  incomeProfileDocumentRequirements,
  processNumberSequences,
  processStatusHistory,
  tenants,
  units,
  users,
} from "@/db/schema";
import { generateChecklistForProcess } from "@/domain/documents/checklist";

async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

async function seedDocumentCatalog() {
  const existingTypes = await db.select().from(documentTypes).limit(1);
  if (existingTypes.length > 0) {
    console.log("Document types already seeded.");
    return;
  }

  const inserted = await db
    .insert(documentTypes)
    .values([
      {
        code: "RG_CPF",
        name: "RG/CPF",
        category: "IDENTIDADE",
        description: "Documento de identificação (RG e/ou CPF)",
      },
      {
        code: "CERTIDAO_ESTADO_CIVIL",
        name: "Certidão de Estado Civil",
        category: "IDENTIDADE",
      },
      {
        code: "COMPROVANTE_ENDERECO",
        name: "Comprovante de Endereço",
        category: "RESIDENCIA",
      },
      {
        code: "CTPS_DIGITAL",
        name: "CTPS Digital",
        category: "TRABALHO",
      },
      {
        code: "EXTRATO_BANCARIO",
        name: "Extrato bancário",
        category: "FINANCEIRO",
        allowsMultiple: true,
        requiresCompetence: true,
      },
      {
        code: "FATURA_CARTAO",
        name: "Fatura de cartão",
        category: "FINANCEIRO",
        allowsMultiple: true,
        requiresCompetence: true,
      },
      {
        code: "CONTRACHEQUE",
        name: "Contracheque",
        category: "RENDA",
        allowsMultiple: true,
        requiresCompetence: true,
      },
    ])
    .returning();

  const byCode = Object.fromEntries(inserted.map((t) => [t.code, t]));

  await db.insert(incomeProfileDocumentRequirements).values([
    {
      incomeProfile: "AUTONOMO",
      documentTypeId: byCode.RG_CPF.id,
      requirement: "OBRIGATORIO",
      quantity: 1,
      sortOrder: 10,
      labelTemplate: "RG/CPF",
    },
    {
      incomeProfile: "AUTONOMO",
      documentTypeId: byCode.CERTIDAO_ESTADO_CIVIL.id,
      requirement: "OBRIGATORIO",
      quantity: 1,
      sortOrder: 20,
      labelTemplate: "Certidão de Estado Civil",
    },
    {
      incomeProfile: "AUTONOMO",
      documentTypeId: byCode.COMPROVANTE_ENDERECO.id,
      requirement: "OBRIGATORIO",
      quantity: 1,
      sortOrder: 30,
      labelTemplate: "Comprovante de Endereço",
    },
    {
      incomeProfile: "AUTONOMO",
      documentTypeId: byCode.CTPS_DIGITAL.id,
      requirement: "OBRIGATORIO",
      quantity: 1,
      sortOrder: 40,
      labelTemplate: "CTPS Digital",
    },
    {
      incomeProfile: "AUTONOMO",
      documentTypeId: byCode.EXTRATO_BANCARIO.id,
      requirement: "OBRIGATORIO",
      quantity: 3,
      sortOrder: 50,
      labelTemplate: "Extrato bancário — {competence}",
    },
    {
      incomeProfile: "AUTONOMO",
      documentTypeId: byCode.FATURA_CARTAO.id,
      requirement: "CONDICIONAL",
      quantity: 3,
      sortOrder: 60,
      labelTemplate: "Fatura cartão — {competence}",
      conditionKey: "HAS_CREDIT_CARD",
    },
    {
      incomeProfile: "CLT",
      documentTypeId: byCode.RG_CPF.id,
      requirement: "OBRIGATORIO",
      quantity: 1,
      sortOrder: 10,
      labelTemplate: "RG/CPF",
    },
    {
      incomeProfile: "CLT",
      documentTypeId: byCode.CERTIDAO_ESTADO_CIVIL.id,
      requirement: "OBRIGATORIO",
      quantity: 1,
      sortOrder: 20,
      labelTemplate: "Certidão de Estado Civil",
    },
    {
      incomeProfile: "CLT",
      documentTypeId: byCode.COMPROVANTE_ENDERECO.id,
      requirement: "OBRIGATORIO",
      quantity: 1,
      sortOrder: 30,
      labelTemplate: "Comprovante de Endereço",
    },
    {
      incomeProfile: "CLT",
      documentTypeId: byCode.CTPS_DIGITAL.id,
      requirement: "OBRIGATORIO",
      quantity: 1,
      sortOrder: 40,
      labelTemplate: "CTPS Digital",
    },
    {
      incomeProfile: "CLT",
      documentTypeId: byCode.CONTRACHEQUE.id,
      requirement: "OBRIGATORIO",
      quantity: 2,
      sortOrder: 50,
      labelTemplate: "Contracheque — {competence}",
    },
  ]);

  console.log("Document catalog seeded (AUTONOMO + CLT).");
}

async function seed() {
  console.log("Seeding ZION CREDIT demo data...");

  await seedDocumentCatalog();

  const existing = await db.select().from(tenants).limit(1);
  if (existing.length > 0) {
    console.log("Tenant data already seeded. Skipping demo entities.");
    return;
  }

  const [tenant] = await db
    .insert(tenants)
    .values({
      name: "ZION Crédito Imobiliário Demo",
      slug: "zion-demo",
      document: "00.000.000/0001-00",
      settings: { timezone: "America/Sao_Paulo", currency: "BRL" },
    })
    .returning();

  const passwordHash = await hashPassword("Zion@Demo123");

  const [admin, analista, correspondente] = await db
    .insert(users)
    .values([
      {
        tenantId: tenant.id,
        email: "admin@zioncredit.demo",
        passwordHash,
        fullName: "Administrador ZION",
        role: "ADMIN",
        phone: "11999990001",
      },
      {
        tenantId: tenant.id,
        email: "analista@zioncredit.demo",
        passwordHash,
        fullName: "Carla Analista",
        role: "ANALISTA",
        phone: "11999990002",
      },
      {
        tenantId: tenant.id,
        email: "corresp@zioncredit.demo",
        passwordHash,
        fullName: "Roberto Correspondente",
        role: "CORRESPONDENTE",
        phone: "11999990003",
      },
    ])
    .returning();

  const [correspondent] = await db
    .insert(correspondents)
    .values({
      tenantId: tenant.id,
      companyName: "Correspondente Horizonte Ltda",
      cnpj: "12345678000199",
      responsibleName: "Roberto Correspondente",
      phone: "11999990003",
      email: "corresp@zioncredit.demo",
    })
    .returning();

  const [development] = await db
    .insert(developments)
    .values({
      tenantId: tenant.id,
      name: "Residencial Aurora",
      developer: "Aurora Incorporações",
      builder: "Construtora Norte",
      street: "Av. das Palmeiras, 1000",
      city: "São Paulo",
      state: "SP",
      minValue: "280000.00",
      maxValue: "520000.00",
      status: "ATIVO",
    })
    .returning();

  const [unit] = await db
    .insert(units)
    .values({
      tenantId: tenant.id,
      developmentId: development.id,
      block: "A",
      unitNumber: "1203",
      floor: 12,
      areaM2: "58.40",
      bedrooms: 2,
      parkingSpaces: 1,
      value: "320000.00",
      status: "DISPONIVEL",
    })
    .returning();

  const [client] = await db
    .insert(clients)
    .values({
      tenantId: tenant.id,
      fullName: "Ana Paula Martins Santos",
      cpf: "52998224725",
      rg: "12.345.678-9",
      birthDate: "1990-04-12",
      maritalStatus: "SOLTEIRO",
      nationality: "Brasileira",
      profession: "Costureira",
      occupationType: "AUTONOMO",
      activityStartDate: "2018-03-01",
      phone: "11987654321",
      whatsapp: "11987654321",
      email: "ana.paula.demo@example.com",
      declaredIncome: "2550.00",
      fgtsBalance: "4200.00",
      downPaymentAvailable: "15000.00",
      primaryBank: "Nubank",
      bankAccount: "****-****",
      overdraftLimit: "0.00",
      notes: "Cliente fictício. Cartão Midway limite R$ 3.900.",
      createdByUserId: correspondente.id,
    })
    .returning();

  await db.insert(clientAddresses).values({
    tenantId: tenant.id,
    clientId: client.id,
    street: "Rua das Acácias",
    number: "245",
    complement: "Apto 12",
    neighborhood: "Vila Nova",
    city: "São Paulo",
    state: "SP",
    zipCode: "01310100",
    isPrimary: true,
  });

  const year = new Date().getFullYear();
  await db.insert(processNumberSequences).values({
    tenantId: tenant.id,
    year,
    lastNumber: 1,
  });

  const processNumber = `PF-${year}-000001`;

  const [process] = await db
    .insert(financingProcesses)
    .values({
      tenantId: tenant.id,
      processNumber,
      clientId: client.id,
      incomeProfile: "AUTONOMO",
      correspondentId: correspondent.id,
      analystId: analista.id,
      developmentId: development.id,
      unitId: unit.id,
      intendedBank: "Caixa Econômica Federal",
      propertyValue: "320000.00",
      downPayment: "15000.00",
      financedAmount: "300800.00",
      fgtsAmount: "4200.00",
      amortizationSystem: "SAC",
      financingType: "SBPE",
      status: "EM_ANALISE",
      createdByUserId: correspondente.id,
    })
    .returning();

  await db.insert(processStatusHistory).values([
    {
      tenantId: tenant.id,
      processId: process.id,
      fromStatus: null,
      toStatus: "NOVO",
      reason: "Abertura do processo",
      changedByUserId: correspondente.id,
    },
    {
      tenantId: tenant.id,
      processId: process.id,
      fromStatus: "NOVO",
      toStatus: "DOCUMENTACAO_PENDENTE",
      reason: "Aguardando documentos iniciais",
      changedByUserId: correspondente.id,
    },
    {
      tenantId: tenant.id,
      processId: process.id,
      fromStatus: "DOCUMENTACAO_PENDENTE",
      toStatus: "DOCUMENTACAO_RECEBIDA",
      reason: "Documentos iniciais recebidos",
      changedByUserId: correspondente.id,
    },
    {
      tenantId: tenant.id,
      processId: process.id,
      fromStatus: "DOCUMENTACAO_RECEBIDA",
      toStatus: "EM_TRIAGEM",
      reason: "Triagem iniciada",
      changedByUserId: analista.id,
    },
    {
      tenantId: tenant.id,
      processId: process.id,
      fromStatus: "EM_TRIAGEM",
      toStatus: "EM_ANALISE",
      reason: "Encaminhado para análise",
      changedByUserId: analista.id,
    },
  ]);

  await generateChecklistForProcess(tenant.id, process.id, "AUTONOMO", {
    hasCreditCard: true,
  });

  console.log("Seed complete.");
  console.log("Login: admin@zioncredit.demo / Zion@Demo123");
  console.log(`Processo demo: ${processNumber}`);
  console.log(`Admin user id: ${admin.id}`);
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
