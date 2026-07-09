-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "domainsLive" INTEGER,
ADD COLUMN     "inboxesWarming" INTEGER,
ADD COLUMN     "warmupSends" INTEGER;
