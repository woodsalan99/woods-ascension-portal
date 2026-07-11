-- CreateEnum
CREATE TYPE "CallType" AS ENUM ('DISCOVERY', 'SALES');

-- AlterTable
ALTER TABLE "PipelineEntry" ADD COLUMN     "nextActionStep" TEXT;

-- CreateTable
CREATE TABLE "PipelineCall" (
    "id" TEXT NOT NULL,
    "pipelineEntryId" TEXT NOT NULL,
    "type" "CallType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineCall_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PipelineCall" ADD CONSTRAINT "PipelineCall_pipelineEntryId_fkey" FOREIGN KEY ("pipelineEntryId") REFERENCES "PipelineEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
