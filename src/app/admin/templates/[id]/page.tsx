import { prisma } from "@/lib/prisma";
import {
  createTemplateMilestone,
  createTemplateStep,
  deleteTemplateMilestone,
  deleteTemplateStep,
  updateTemplateMilestone,
  updateTemplateStep,
  upsertTemplateMetric,
} from "../actions";
import type { MetricKey } from "@prisma/client";

const METRIC_KEYS = [
  "EMAILS_SENT",
  "POSITIVE_REPLIES",
  "QUALIFIED_APPTS",
  "POSITIVE_REPLY_RATE",
  "EMAILS_PER_BOOKED",
  "EMAILS_PER_QUALIFIED",
] as const;
const METRIC_LABELS: Record<(typeof METRIC_KEYS)[number], string> = {
  EMAILS_SENT: "Emails Sent",
  POSITIVE_REPLIES: "Positive Replies",
  QUALIFIED_APPTS: "Qualified Appointments",
  POSITIVE_REPLY_RATE: "Positive Reply %",
  EMAILS_PER_BOOKED: "Emails per Booked Appt",
  EMAILS_PER_QUALIFIED: "Emails per Qualified Appt",
};

export default async function TemplateDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = await prisma.template.findUniqueOrThrow({
    where: { id },
    include: {
      steps: { orderBy: { sortOrder: "asc" } },
      metrics: true,
      milestones: { orderBy: { sortOrder: "asc" } },
    },
  });

  const metricByKey = new Map(template.metrics.map((m) => [m.metricKey, m]));

  return (
    <div className="p-8 text-sm max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Template: {template.name}</h1>
        <a href="/admin/templates" className="text-blue-600 underline">
          ← Back to templates
        </a>
      </div>

      {/* Roadmap steps */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-3">Roadmap steps</h2>
        <table className="w-full mb-3">
          <tbody>
            {template.steps.map((s) => (
              <tr key={s.id} className="border-t">
                <td>
                  <form
                    key={`${s.dayLabel}-${s.sortOrder}-${s.clientActionable}`}
                    action={updateTemplateStep.bind(null, template.id, s.id)}
                    className="space-y-1 py-1"
                  >
                    <div className="grid grid-cols-6 gap-1 items-center">
                      <input name="label" defaultValue={s.label} className="border p-1 col-span-2" placeholder="Title" />
                      <input name="dayLabel" defaultValue={s.dayLabel} className="border p-1" placeholder="Day label" />
                      <input name="ctaLabel" defaultValue={s.ctaLabel ?? ""} placeholder="CTA label" className="border p-1" />
                      <input name="ctaUrl" defaultValue={s.ctaUrl ?? ""} placeholder="CTA URL" className="border p-1" />
                      <input type="number" name="sortOrder" defaultValue={s.sortOrder} className="border p-1 w-16" />
                    </div>
                    <textarea
                      name="description"
                      defaultValue={s.description ?? ""}
                      placeholder="Description (optional)"
                      className="border p-1 w-full text-xs"
                      rows={2}
                    />
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" name="clientActionable" defaultChecked={s.clientActionable} /> client can complete
                      </label>
                      <button className="underline text-xs">save</button>
                    </div>
                  </form>
                  <form action={deleteTemplateStep.bind(null, template.id, s.id)}>
                    <button className="underline text-red-600 text-xs">delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={createTemplateStep.bind(null, template.id)} className="grid grid-cols-4 gap-2">
          <input name="label" placeholder="Label" className="border p-1" required />
          <input name="dayLabel" placeholder="Day label" className="border p-1" required />
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" name="clientActionable" /> client can complete
          </label>
          <textarea name="description" placeholder="Description (optional)" className="border p-1 col-span-4 text-xs" rows={2} />
          <button className="bg-black text-white px-3 py-1 rounded col-span-4">Add step</button>
        </form>
      </section>

      {/* Metric configs */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-3">Metric KPIs</h2>
        <div className="grid grid-cols-6 gap-2 py-1 text-xs font-semibold text-gray-500">
          <span>Metric</span>
          <span>Cadence</span>
          <span>Min</span>
          <span>Max</span>
          <span>Tip 1</span>
          <span>Tip 2</span>
        </div>
        {METRIC_KEYS.map((key) => {
          const config = metricByKey.get(key as MetricKey);
          const tips = (config?.tips as string[] | undefined) ?? [];
          return (
            <form
              key={`${key}-${config?.cadence ?? ""}-${config?.targetMin ?? ""}-${config?.targetMax ?? ""}-${tips.join("|")}`}
              action={upsertTemplateMetric.bind(null, template.id, key as MetricKey)}
              className="grid grid-cols-6 gap-2 py-2 border-t items-center"
            >
              <span className="font-medium">{METRIC_LABELS[key]}</span>
              <select name="cadence" defaultValue={config?.cadence ?? "PERPETUAL"} className="border p-1">
                <option value="WEEKLY">Weekly</option>
                <option value="DAILY">Daily</option>
                <option value="PERPETUAL">Perpetual</option>
              </select>
              <input type="number" step="any" name="targetMin" defaultValue={config?.targetMin ?? ""} placeholder="Min" className="border p-1" />
              <input type="number" step="any" name="targetMax" defaultValue={config?.targetMax ?? ""} placeholder="Max" className="border p-1" />
              <input name="tip1" defaultValue={tips[0] ?? ""} placeholder="Tip 1" className="border p-1" />
              <div className="flex gap-1">
                <input name="tip2" defaultValue={tips[1] ?? ""} placeholder="Tip 2" className="border p-1 flex-1" />
                <button className="underline">save</button>
              </div>
            </form>
          );
        })}
      </section>

      {/* Milestones */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-3">Milestones (campaign journey)</h2>
        <table className="w-full mb-3">
          <tbody>
            {template.milestones.map((m) => (
              <tr key={m.id} className="border-t">
                <td>
                  <form
                    key={`${m.sortOrder}-${m.targetValue}`}
                    action={updateTemplateMilestone.bind(null, template.id, m.id)}
                    className="grid grid-cols-5 gap-1 py-1 items-center"
                  >
                    <input name="label" defaultValue={m.label} className="border p-1 col-span-2" />
                    <input name="subLabel" defaultValue={m.subLabel ?? ""} className="border p-1" />
                    <input type="number" name="targetValue" defaultValue={m.targetValue ?? ""} placeholder="target" className="border p-1" />
                    <input type="number" name="sortOrder" defaultValue={m.sortOrder} className="border p-1 w-16" />
                    <button className="underline">save</button>
                  </form>
                  <form action={deleteTemplateMilestone.bind(null, template.id, m.id)}>
                    <button className="underline text-red-600 text-xs">delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={createTemplateMilestone.bind(null, template.id)} className="grid grid-cols-3 gap-2">
          <input name="label" placeholder="Label" className="border p-1" required />
          <input name="subLabel" placeholder="Sub-label" className="border p-1" />
          <input type="number" name="targetValue" placeholder="Target value" className="border p-1" />
          <button className="bg-black text-white px-3 py-1 rounded col-span-3">Add milestone</button>
        </form>
      </section>
    </div>
  );
}
