-- "Campaign focus" cards on the Overview: AI draft + optional manual override.
ALTER TABLE "MonthlyWork" ADD COLUMN "focusAuto" JSONB;
ALTER TABLE "MonthlyWork" ADD COLUMN "focusManual" JSONB;
