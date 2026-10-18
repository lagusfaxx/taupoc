-- CreateTable
CREATE TABLE "McpLog" (
    "id" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "args" JSONB,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "result" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "McpLog_createdAt_idx" ON "McpLog"("createdAt");

-- CreateIndex
CREATE INDEX "McpLog_tool_idx" ON "McpLog"("tool");
