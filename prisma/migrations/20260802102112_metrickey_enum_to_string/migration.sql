-- Convert MetricKey from a fixed Postgres enum to a plain String column.
-- Hand-written (not Prisma-generated) to preserve existing data: a naive
-- drop-and-recreate migration would have deleted every MetricConfig and
-- TemplateMetricConfig row. Existing enum values become plain strings
-- with the exact same text, so no data changes meaning.
ALTER TABLE "MetricConfig" ALTER COLUMN "metricKey" TYPE TEXT USING "metricKey"::text;
ALTER TABLE "TemplateMetricConfig" ALTER COLUMN "metricKey" TYPE TEXT USING "metricKey"::text;
DROP TYPE "MetricKey";
