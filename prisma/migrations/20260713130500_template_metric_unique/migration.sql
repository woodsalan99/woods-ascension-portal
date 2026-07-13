-- CreateIndex
CREATE UNIQUE INDEX "TemplateMetricConfig_templateId_metricKey_key" ON "TemplateMetricConfig"("templateId", "metricKey");
