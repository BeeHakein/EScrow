-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Clause" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "heading" TEXT,
    "text" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    CONSTRAINT "Clause_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "overallLevel" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "generatedAt" TEXT NOT NULL,
    "reportHash" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ClauseRisk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "clauseId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "rationale" TEXT NOT NULL,
    "recommendation" TEXT,
    CONSTRAINT "ClauseRisk_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "RiskReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Escrow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "freelancer" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "escrowId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountWei" TEXT NOT NULL,
    "amountToken" TEXT NOT NULL,
    "status" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "PartySignature" (
    "escrowId" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "signer" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "signedHash" TEXT NOT NULL,
    "signedAt" TEXT NOT NULL,

    PRIMARY KEY ("escrowId", "party")
);

-- CreateIndex
CREATE INDEX "Party_userId_idx" ON "Party"("userId");

-- CreateIndex
CREATE INDEX "Party_walletAddress_idx" ON "Party"("walletAddress");

-- CreateIndex
CREATE INDEX "Contract_uploadedBy_idx" ON "Contract"("uploadedBy");

-- CreateIndex
CREATE INDEX "Clause_contractId_idx" ON "Clause"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "Clause_contractId_index_key" ON "Clause"("contractId", "index");

-- CreateIndex
CREATE INDEX "RiskReport_contractId_idx" ON "RiskReport"("contractId");

-- CreateIndex
CREATE INDEX "ClauseRisk_reportId_idx" ON "ClauseRisk"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "ClauseRisk_reportId_clauseId_key" ON "ClauseRisk"("reportId", "clauseId");

-- CreateIndex
CREATE UNIQUE INDEX "Escrow_contractId_key" ON "Escrow"("contractId");

-- CreateIndex
CREATE INDEX "Escrow_client_idx" ON "Escrow"("client");

-- CreateIndex
CREATE INDEX "Escrow_freelancer_idx" ON "Escrow"("freelancer");

-- CreateIndex
CREATE INDEX "Milestone_escrowId_idx" ON "Milestone"("escrowId");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_escrowId_index_key" ON "Milestone"("escrowId", "index");

-- CreateIndex
CREATE INDEX "PartySignature_escrowId_idx" ON "PartySignature"("escrowId");
