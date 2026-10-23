-- The panel speaks MCP, so an AI client can work it by conversation.
--
-- Five tables and one column. The column is the per-person switch: AI access
-- is off for everybody until somebody turns it on, the owner included, and it
-- sits beside the role's `ai.write` permission rather than replacing it.
--
-- The tables are OAuth (clients, one-time codes, hashed tokens), the queue of
-- writes that wait for a person to approve them, and the log of every call an
-- AI made — the refused ones included, which `activity_logs` never sees.
-- Nothing here is read by the website.
-- CreateEnum
CREATE TYPE "McpApprovalStatus" AS ENUM ('PENDING', 'EXECUTING', 'COMPLETED', 'REJECTED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "McpRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "McpCallStatus" AS ENUM ('SUCCESS', 'DENIED', 'APPROVAL_REQUIRED', 'REJECTED', 'FAILED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mcpAccessEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "mcp_oauth_clients" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "secretHash" TEXT,
    "redirectUris" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "grantTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scope" TEXT NOT NULL DEFAULT '',
    "clientUri" TEXT,
    "softwareId" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "mcp_oauth_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_auth_codes" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resource" TEXT,
    "codeChallenge" TEXT NOT NULL,
    "codeChallengeMethod" TEXT NOT NULL DEFAULT 'S256',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_auth_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_tokens" (
    "id" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "refreshTokenHash" TEXT,
    "rotatedToId" TEXT,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resource" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_approvals" (
    "id" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedVia" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "risk" "McpRisk" NOT NULL DEFAULT 'HIGH',
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "entityLabel" TEXT,
    "summary" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "proposedChanges" JSONB NOT NULL,
    "preconditions" JSONB NOT NULL,
    "status" "McpApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "executedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "result" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "clientId" TEXT,
    "clientLabel" TEXT,
    "tool" TEXT NOT NULL,
    "arguments" JSONB,
    "entityType" TEXT,
    "entityId" TEXT,
    "entityLabel" TEXT,
    "status" "McpCallStatus" NOT NULL,
    "errorCode" TEXT,
    "result" JSONB,
    "approvalId" TEXT,
    "approvedById" TEXT,
    "rejectedById" TEXT,
    "durationMs" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_oauth_clients_clientId_key" ON "mcp_oauth_clients"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_auth_codes_codeHash_key" ON "mcp_auth_codes"("codeHash");

-- CreateIndex
CREATE INDEX "mcp_auth_codes_userId_idx" ON "mcp_auth_codes"("userId");

-- CreateIndex
CREATE INDEX "mcp_auth_codes_expiresAt_idx" ON "mcp_auth_codes"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_tokens_accessTokenHash_key" ON "mcp_tokens"("accessTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_tokens_refreshTokenHash_key" ON "mcp_tokens"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "mcp_tokens_userId_idx" ON "mcp_tokens"("userId");

-- CreateIndex
CREATE INDEX "mcp_tokens_clientId_idx" ON "mcp_tokens"("clientId");

-- CreateIndex
CREATE INDEX "mcp_tokens_familyId_idx" ON "mcp_tokens"("familyId");

-- CreateIndex
CREATE INDEX "mcp_tokens_expiresAt_idx" ON "mcp_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "mcp_approvals_status_createdAt_idx" ON "mcp_approvals"("status", "createdAt");

-- CreateIndex
CREATE INDEX "mcp_approvals_requestedById_idx" ON "mcp_approvals"("requestedById");

-- CreateIndex
CREATE INDEX "mcp_approvals_entityType_entityId_idx" ON "mcp_approvals"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "mcp_approvals_expiresAt_idx" ON "mcp_approvals"("expiresAt");

-- CreateIndex
CREATE INDEX "mcp_audit_logs_userId_idx" ON "mcp_audit_logs"("userId");

-- CreateIndex
CREATE INDEX "mcp_audit_logs_tool_idx" ON "mcp_audit_logs"("tool");

-- CreateIndex
CREATE INDEX "mcp_audit_logs_status_idx" ON "mcp_audit_logs"("status");

-- CreateIndex
CREATE INDEX "mcp_audit_logs_createdAt_idx" ON "mcp_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "mcp_audit_logs_approvalId_idx" ON "mcp_audit_logs"("approvalId");

-- AddForeignKey
ALTER TABLE "mcp_auth_codes" ADD CONSTRAINT "mcp_auth_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_auth_codes" ADD CONSTRAINT "mcp_auth_codes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "mcp_oauth_clients"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_tokens" ADD CONSTRAINT "mcp_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_tokens" ADD CONSTRAINT "mcp_tokens_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "mcp_oauth_clients"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_approvals" ADD CONSTRAINT "mcp_approvals_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_approvals" ADD CONSTRAINT "mcp_approvals_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_approvals" ADD CONSTRAINT "mcp_approvals_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_audit_logs" ADD CONSTRAINT "mcp_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

