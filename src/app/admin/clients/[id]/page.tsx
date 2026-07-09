import { prisma } from "@/lib/prisma";
import {
  createAudience,
  createCampaign,
  createInfrastructureItem,
  createMilestone,
  createOnboardingStep,
  createPipelineEntry,
  createWeeklyNote,
  deleteAudience,
  deleteCampaign,
  deleteInfrastructureItem,
  deleteMilestone,
  deleteOnboardingStep,
  deletePipelineEntry,
  deleteWeeklyNote,
  inviteUserAction,
  renameAudience,
  setCampaignAudience,
  toggleCampaignActive,
  toggleNotePublished,
  updateClient,
  updateInfrastructureItem,
  updateMilestone,
  updateOnboardingStep,
  updatePipelineEntry,
  upsertMetricConfig,
} from "./actions";

const STAGE_KEYS = ["STAGE_1", "STAGE_2", "STAGE_3", "STAGE_4"] as const;
const MILESTONE_STATES = ["DONE", "CURRENT", "NEXT"] as const;
const STEP_STATES = ["DONE", "CURRENT", "ACTIVE", "NEXT"] as const;
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

export default async function AdminClientDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const client = await prisma.client.findUniqueOrThrow({
    where: { id },
    include: {
      campaigns: true,
      pipeline: true,
      milestones: { orderBy: { sortOrder: "asc" } },
      onboarding: { orderBy: { sortOrder: "asc" } },
      notes: { orderBy: { weekOf: "desc" } },
      users: true,
      audiences: { orderBy: { sortOrder: "asc" } },
      infrastructure: { orderBy: { sortOrder: "asc" } },
      metricConfigs: true,
    },
  });

  const stageLabels = (client.stageLabels as Record<string, string>) ?? {};
  const metricConfigByKey = new Map(client.metricConfigs.map((c) => [c.metricKey, c]));
  const boundUpdateClient = updateClient.bind(null, id);
  const boundCreateCampaign = createCampaign.bind(null, id);
  const boundCreatePipelineEntry = createPipelineEntry.bind(null, id);
  const boundCreateMilestone = createMilestone.bind(null, id);
  const boundCreateOnboardingStep = createOnboardingStep.bind(null, id);
  const boundCreateWeeklyNote = createWeeklyNote.bind(null, id);
  const boundInviteUser = inviteUserAction.bind(null, id);
  const boundCreateAudience = createAudience.bind(null, id);
  const boundCreateInfrastructureItem = createInfrastructureItem.bind(null, id);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10 text-sm">
      <div>
        <a href="/admin" className="text-blue-600 underline">
          ← All clients
        </a>
        <h1 className="text-xl font-bold mt-2">{client.name}</h1>
      </div>

      {/* Client fields */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-3">Client details</h2>
        <form action={boundUpdateClient} className="grid grid-cols-2 gap-3">
          <label>Name<input name="name" defaultValue={client.name} className="border w-full p-1" /></label>
          <label>Hero name<input name="heroName" defaultValue={client.heroName ?? ""} className="border w-full p-1" /></label>
          <label>Timezone<input name="timezone" defaultValue={client.timezone} className="border w-full p-1" /></label>
          <label>
            Status
            <select name="status" defaultValue={client.status} className="border w-full p-1">
              <option value="ACTIVE">ACTIVE</option>
              <option value="PAUSED">PAUSED</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </label>
          <label>Calendar link<input name="calendarLink" defaultValue={client.calendarLink ?? ""} className="border w-full p-1" /></label>
          <label>Intake form link<input name="intakeFormLink" defaultValue={client.intakeFormLink ?? ""} className="border w-full p-1" /></label>
          <label>
            Launch date
            <input
              type="date"
              name="launchDate"
              defaultValue={client.launchDate ? client.launchDate.toISOString().slice(0, 10) : ""}
              className="border w-full p-1"
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label>Domains live<input type="number" name="domainsLive" defaultValue={client.domainsLive ?? ""} className="border w-full p-1" /></label>
            <label>Inboxes warming<input type="number" name="inboxesWarming" defaultValue={client.inboxesWarming ?? ""} className="border w-full p-1" /></label>
            <label>Warmup sends<input type="number" name="warmupSends" defaultValue={client.warmupSends ?? ""} className="border w-full p-1" /></label>
          </div>
          <div className="col-span-2 grid grid-cols-4 gap-2">
            <label>Stage 1 label<input name="stage1Label" defaultValue={stageLabels.STAGE_1 ?? ""} className="border w-full p-1" /></label>
            <label>Stage 2 label<input name="stage2Label" defaultValue={stageLabels.STAGE_2 ?? ""} className="border w-full p-1" /></label>
            <label>Stage 3 label<input name="stage3Label" defaultValue={stageLabels.STAGE_3 ?? ""} className="border w-full p-1" /></label>
            <label>Stage 4 label<input name="stage4Label" defaultValue={stageLabels.STAGE_4 ?? ""} className="border w-full p-1" /></label>
          </div>
          <button className="col-span-2 bg-black text-white py-1 rounded">Save</button>
        </form>
      </section>

      {/* Users */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-3">Users &amp; invitations</h2>
        <ul className="mb-3">
          {client.users.map((u) => (
            <li key={u.id}>{u.email} — {u.role}</li>
          ))}
        </ul>
        <form action={boundInviteUser} className="flex gap-2">
          <input name="email" placeholder="email@domain.com" className="border p-1 flex-1" required />
          <select name="role" className="border p-1">
            <option value="CLIENT">CLIENT</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <button className="bg-black text-white px-3 py-1 rounded">Invite</button>
        </form>
      </section>

      {/* Audiences (v1.1) */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-3">Audiences</h2>
        <p className="text-gray-500 mb-3">
          Market segments (e.g. &quot;Limos&quot;, &quot;Towing&quot;). Assign campaigns and pipeline entries to
          an audience below so the client can filter Metrics/Appointments by it.
        </p>
        <table className="w-full mb-3">
          <tbody>
            {client.audiences.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="py-1">
                  <form action={renameAudience.bind(null, id, a.id)} className="flex gap-2 items-center">
                    <input name="name" defaultValue={a.name} className="border p-1 flex-1" />
                    <button className="underline">save</button>
                  </form>
                </td>
                <td>
                  <form action={deleteAudience.bind(null, id, a.id)}>
                    <button className="underline text-red-600 text-xs">delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={boundCreateAudience} className="flex gap-2">
          <input name="name" placeholder="Audience name" className="border p-1 flex-1" required />
          <button className="bg-black text-white px-3 py-1 rounded">Add audience</button>
        </form>
      </section>

      {/* Campaigns */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-3">Campaigns</h2>
        <table className="w-full mb-3">
          <thead><tr className="text-left"><th>Name</th><th>Smartlead ID</th><th>Active</th><th>Audience</th><th></th></tr></thead>
          <tbody>
            {client.campaigns.map((c) => (
              <tr key={c.id} className="border-t">
                <td>{c.name}</td>
                <td>{c.smartleadCampaignId}</td>
                <td>{c.active ? "yes" : "no"}</td>
                <td>
                  <form action={setCampaignAudience.bind(null, id, c.id)} className="flex gap-1">
                    <select name="audienceId" defaultValue={c.audienceId ?? ""} className="border p-1">
                      <option value="">— none —</option>
                      {client.audiences.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <button className="underline text-xs">save</button>
                  </form>
                </td>
                <td className="flex gap-2">
                  <form action={toggleCampaignActive.bind(null, id, c.id)}>
                    <button className="underline">{c.active ? "deactivate" : "activate"}</button>
                  </form>
                  <form action={deleteCampaign.bind(null, id, c.id)}>
                    <button className="underline text-red-600">delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={boundCreateCampaign} className="grid grid-cols-4 gap-2">
          <input name="name" placeholder="Campaign name" className="border p-1" required />
          <input name="smartleadCampaignId" placeholder="Smartlead campaign ID" className="border p-1" required />
          <select name="audienceId" className="border p-1">
            <option value="">— no audience —</option>
            {client.audiences.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button className="bg-black text-white px-3 py-1 rounded">Add</button>
        </form>
      </section>

      {/* Pipeline */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-3">Pipeline</h2>
        <table className="w-full mb-3">
          <thead>
            <tr className="text-left">
              <th>Contact</th><th>Company</th><th>Stage</th><th>Value</th><th>Qualified</th><th>Call</th><th></th>
            </tr>
          </thead>
          <tbody>
            {client.pipeline.map((p) => (
              <tr key={p.id} className="border-t align-top">
                <td colSpan={7}>
                  <form
                    action={updatePipelineEntry.bind(null, id, p.id)}
                    className="grid grid-cols-7 gap-1 py-1 items-center"
                  >
                    <input name="contactName" defaultValue={p.contactName} className="border p-1" />
                    <input name="company" defaultValue={p.company} className="border p-1" />
                    <select name="stage" defaultValue={p.stage} className="border p-1">
                      {STAGE_KEYS.map((s) => (
                        <option key={s} value={s}>{stageLabels[s] ?? s}</option>
                      ))}
                    </select>
                    <input type="number" name="dealValue" defaultValue={p.dealValue ?? ""} className="border p-1" />
                    <label className="flex items-center gap-1">
                      <input type="checkbox" name="qualified" defaultChecked={p.qualified} /> qual.
                    </label>
                    <input
                      type="datetime-local"
                      name="callDateTime"
                      defaultValue={p.callDateTime ? p.callDateTime.toISOString().slice(0, 16) : ""}
                      className="border p-1"
                    />
                    <div className="flex gap-1">
                      <button className="underline">save</button>
                    </div>
                    <select name="audienceId" defaultValue={p.audienceId ?? ""} className="border p-1">
                      <option value="">— no audience —</option>
                      {client.audiences.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <input name="notes" defaultValue={p.notes ?? ""} placeholder="notes" className="border p-1 col-span-2" />
                    <input name="callStatus" defaultValue={p.callStatus ?? ""} placeholder="call status" className="border p-1" />
                    <input name="disqualifiedReason" defaultValue={p.disqualifiedReason ?? ""} placeholder="disqualified reason" className="border p-1 col-span-2" />
                  </form>
                  <form action={deletePipelineEntry.bind(null, id, p.id)}>
                    <button className="underline text-red-600 text-xs">delete entry</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={boundCreatePipelineEntry} className="grid grid-cols-5 gap-2">
          <input name="contactName" placeholder="Contact name" className="border p-1" required />
          <input name="company" placeholder="Company" className="border p-1" required />
          <select name="stage" className="border p-1">
            {STAGE_KEYS.map((s) => (
              <option key={s} value={s}>{stageLabels[s] ?? s}</option>
            ))}
          </select>
          <select name="audienceId" className="border p-1">
            <option value="">— no audience —</option>
            {client.audiences.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <input type="number" name="dealValue" placeholder="Deal value" className="border p-1" />
          <button className="bg-black text-white px-3 py-1 rounded col-span-5">Add pipeline entry</button>
        </form>
      </section>

      {/* Milestones */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-3">Milestones</h2>
        <table className="w-full mb-3">
          <tbody>
            {client.milestones.map((m) => (
              <tr key={m.id} className="border-t">
                <td>
                  <form action={updateMilestone.bind(null, id, m.id)} className="grid grid-cols-6 gap-1 py-1 items-center">
                    <input name="label" defaultValue={m.label} className="border p-1 col-span-2" />
                    <input name="subLabel" defaultValue={m.subLabel ?? ""} className="border p-1" />
                    <select name="state" defaultValue={m.state} className="border p-1">
                      {MILESTONE_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input type="number" name="currentValue" defaultValue={m.currentValue ?? ""} placeholder="current" className="border p-1" />
                    <input type="number" name="targetValue" defaultValue={m.targetValue ?? ""} placeholder="target" className="border p-1" />
                    <input type="number" name="sortOrder" defaultValue={m.sortOrder} className="border p-1 w-16" />
                    <button className="underline">save</button>
                  </form>
                  <form action={deleteMilestone.bind(null, id, m.id)}>
                    <button className="underline text-red-600 text-xs">delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={boundCreateMilestone} className="grid grid-cols-4 gap-2">
          <input name="label" placeholder="Label" className="border p-1" required />
          <input name="subLabel" placeholder="Sub-label" className="border p-1" />
          <select name="state" className="border p-1">
            {MILESTONE_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="number" name="targetValue" placeholder="Target value" className="border p-1" />
          <button className="bg-black text-white px-3 py-1 rounded col-span-4">Add milestone</button>
        </form>
      </section>

      {/* Onboarding */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-3">Onboarding steps</h2>
        <table className="w-full mb-3">
          <tbody>
            {client.onboarding.map((o) => (
              <tr key={o.id} className="border-t">
                <td>
                  <form action={updateOnboardingStep.bind(null, id, o.id)} className="grid grid-cols-7 gap-1 py-1 items-center">
                    <input name="label" defaultValue={o.label} className="border p-1 col-span-2" />
                    <input name="dayLabel" defaultValue={o.dayLabel} className="border p-1" />
                    <select name="state" defaultValue={o.state} className="border p-1">
                      {STEP_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input name="ctaLabel" defaultValue={o.ctaLabel ?? ""} placeholder="CTA label" className="border p-1" />
                    <input name="ctaUrl" defaultValue={o.ctaUrl ?? ""} placeholder="CTA URL" className="border p-1" />
                    <input type="number" name="sortOrder" defaultValue={o.sortOrder} className="border p-1 w-16" />
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" name="clientActionable" defaultChecked={o.clientActionable} /> client can complete
                    </label>
                    <button className="underline col-span-2">save</button>
                  </form>
                  <form action={deleteOnboardingStep.bind(null, id, o.id)}>
                    <button className="underline text-red-600 text-xs">delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={boundCreateOnboardingStep} className="grid grid-cols-4 gap-2">
          <input name="label" placeholder="Label" className="border p-1" required />
          <input name="dayLabel" placeholder="Day label" className="border p-1" required />
          <select name="state" className="border p-1">
            {STEP_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" name="clientActionable" /> client can complete
          </label>
          <button className="bg-black text-white px-3 py-1 rounded col-span-4">Add step</button>
        </form>
      </section>

      {/* Infrastructure (v1.1) */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-3">Infrastructure &amp; costs</h2>
        <table className="w-full mb-3">
          <tbody>
            {client.infrastructure.map((item) => (
              <tr key={item.id} className="border-t">
                <td>
                  <form action={updateInfrastructureItem.bind(null, id, item.id)} className="grid grid-cols-6 gap-1 py-1 items-center">
                    <input name="label" defaultValue={item.label} className="border p-1" />
                    <input type="number" name="quantity" defaultValue={item.quantity} className="border p-1" />
                    <input name="status" defaultValue={item.status} className="border p-1" />
                    <input type="number" name="monthlyCost" defaultValue={item.monthlyCost} className="border p-1" />
                    <input name="notes" defaultValue={item.notes ?? ""} className="border p-1" />
                    <button className="underline">save</button>
                  </form>
                  <form action={deleteInfrastructureItem.bind(null, id, item.id)}>
                    <button className="underline text-red-600 text-xs">delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={boundCreateInfrastructureItem} className="grid grid-cols-5 gap-2">
          <input name="label" placeholder="Label (e.g. Domains)" className="border p-1" required />
          <input type="number" name="quantity" placeholder="Qty" className="border p-1" required />
          <input name="status" placeholder="Status (ACTIVE/LOADED/COMPLETE)" className="border p-1" required />
          <input type="number" name="monthlyCost" placeholder="Monthly $" className="border p-1" required />
          <input name="notes" placeholder="Notes" className="border p-1" />
          <button className="bg-black text-white px-3 py-1 rounded col-span-5">Add item</button>
        </form>
      </section>

      {/* Metric configs (v1.1) */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-3">Metrics targets &amp; tips</h2>
        <p className="text-gray-500 mb-3">
          The numbers themselves are always computed live. This is just the target text, status, and
          &quot;how to improve&quot; tips shown alongside each metric.
        </p>
        {METRIC_KEYS.map((key) => {
          const config = metricConfigByKey.get(key);
          return (
            <form
              key={key}
              action={upsertMetricConfig.bind(null, id, key)}
              className="grid grid-cols-5 gap-2 py-2 border-t items-center"
            >
              <span className="font-medium">{METRIC_LABELS[key]}</span>
              <input name="targetLabel" defaultValue={config?.targetLabel ?? ""} placeholder="Target (e.g. < 600)" className="border p-1" />
              <select name="status" defaultValue={config?.status ?? "ON_TRACK"} className="border p-1">
                <option value="ON_TRACK">On track</option>
                <option value="NEEDS_ATTENTION">Needs attention</option>
              </select>
              <input name="tip1" defaultValue={(config?.tips as string[] | undefined)?.[0] ?? ""} placeholder="Tip 1" className="border p-1" />
              <div className="flex gap-1">
                <input name="tip2" defaultValue={(config?.tips as string[] | undefined)?.[1] ?? ""} placeholder="Tip 2" className="border p-1 flex-1" />
                <button className="underline">save</button>
              </div>
            </form>
          );
        })}
      </section>

      {/* Weekly notes */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-3">Weekly notes</h2>
        <table className="w-full mb-3">
          <tbody>
            {client.notes.map((n) => (
              <tr key={n.id} className="border-t align-top">
                <td className="py-2">
                  <div className="font-semibold">{n.headline} — {n.weekOf.toISOString().slice(0, 10)}</div>
                  <div className="text-gray-600">{n.body}</div>
                  {n.videoUrl && <div className="text-blue-600">{n.videoUrl}</div>}
                  <div className="flex gap-2 mt-1">
                    <form action={toggleNotePublished.bind(null, id, n.id)}>
                      <button className="underline">{n.published ? "unpublish" : "publish"}</button>
                    </form>
                    <form action={deleteWeeklyNote.bind(null, id, n.id)}>
                      <button className="underline text-red-600">delete</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={boundCreateWeeklyNote} className="grid grid-cols-2 gap-2">
          <input type="date" name="weekOf" className="border p-1" required />
          <input name="headline" placeholder="Headline" className="border p-1" required />
          <textarea name="body" placeholder="Body" className="border p-1 col-span-2" required />
          <input name="videoUrl" placeholder="Video URL (Loom/YouTube/other)" className="border p-1 col-span-2" />
          <label className="flex items-center gap-1">
            <input type="checkbox" name="published" /> publish immediately
          </label>
          <button className="bg-black text-white px-3 py-1 rounded col-span-2">Add note</button>
        </form>
      </section>
    </div>
  );
}
