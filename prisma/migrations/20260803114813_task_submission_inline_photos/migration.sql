-- AlterTable
ALTER TABLE "TaskSubmission" ADD COLUMN     "fileData" BYTEA,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileType" TEXT;

