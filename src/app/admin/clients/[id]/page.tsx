import { prisma } from "@/lib/prisma";
import { fetchAllCampaigns } from "@/lib/smartlead";
import { CampaignPicker } from "@/components/admin/CampaignPicker";
import { setPreviewClient } from "@/lib/preview-actions";
import {
  createAudience,
  createCampaign,
  createChangelogEntry,
  createInfrastructureItem,
  createMilestone,
  createOnboardingStep,
  createPipelineEntry,
  createWeeklyNote,
  deleteAudience,
  deleteCampaign,
  deleteChangelogEntry,
  deleteDocument,
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
  uploadDocument,
  upsertMetricConfig,
} from "./actions";

const STAGE_KEYS = ["STAGE_1", "STAGE_2", "STAGE_3", "STAGE_4"] as const;
const CALL_STATUSES = ["CONFIRMED", "PENDING", "HELD", "NO_SHOW"] as const;
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
      // Sort by immutable keys only — sorting by a mutable field (stage)
      // makes an edited row jump position, which reads as the edit vanishing.
      // id breaks ties from createMany (same createdAt on auto-added leads).
      pipeline: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      milestones: { orderBy: { sortOrder: "asc" } },
      onboarding: { orderBy: { sortOrder: "asc" } },
      notes: { orderBy: { weekOf: "desc" } },
      users: true,
      audiences: { orderBy: { sortOrder: "asc" } },
      infrastructure: { orderBy: { sortOrder: "asc" } },
      metricConfigs: true,
      changelog: { orderBy: { date: "desc" } },
      documents: { orderBy: { docDate: "desc" }, select: { id: true, name: true, fileName: true, note: true, docDate: true } },
    },
  });

  const smartleadCampaigns = await fetchAllCampaigns().catch(() => []);

  const stageLabels = (client.stageLabels as Record<string, string>) ?? {};
  const metricConfigByKey = new Map(client.metricConfigs.map((c) => [c.metricKey, c]));
  const boundUpdateClient = updateClient.bind(null, id);
  const boundCreateCampaign = createCampaign.bind(null, id);
  const boundCreatePipelineEntry = createPipelineEntry.bind(null, id);
  const boundCreateMilestone = createMilestone.bind(null, id);
  const boundCreateOnboardingStep = createOnboardingStep.bind(null, id);
  const boundCreateWeeklyNote = createWeeklyNote.bind(null, id);
  const boundCreateChangelogEntry = createChangelogEntry.bind(null, id);
  const boundUploadDocument = uploadDocument.bind(null, id);
  const boundInviteUser = inviteUserAction.bind(null, id);
  const boundCreateAudience = createAudience.bind(null, id);
  const boundCreateInfrastructureItem = createInfrastructureItem.bind(null, id);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10 text-sm">
      <div className="flex items-start justify-between">
        <div>
          <a href="/admin" className="text-blue-600 underline">
            ← All clients
          </a>
          <h1 className="text-xl font-bold mt-2">{client.name}</h1>
        </div>
        <form action={setPreviewClient.bind(null, id)}>
          <button className="bg-black text-white px-3 py-2 rounded">
            View dashboard as this client →
          </button>
        </form>
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
          <CampaignPicker campaigns={smartleadCampaigns} />
          <select name="audienceId" className="border p-1">
            <option value="">— no audience —</option>
            {client.audiences.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button className="bg-black text-white px-3 py-1 rounded">Add</button>
        </form>
        {smartleadCampaigns.length === 0 && (
          <p className="text-gray-400 text-xs mt-1">
            Couldn&apos;t reach Smartlead for autocomplete — you can still type the campaign name and ID manually.
          </p>
        )}
      </section>

      {/* Pipeline */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-3">Pipeline</h2>
        <div className="space-y-3 mb-4">
          {client.pipeline.map((p) => (
            <div key={p.id} className="border rounded p-2">
              <form action={updatePipelineEntry.bind(null, id, p.id)} className="space-y-1">
                <div className="grid grid-cols-4 gap-1">
                  <label className="text-xs">Contact<input name="contactName" defaultValue={p.contactName} className="border p-1 w-full" /></label>
                  <label className="text-xs">Email<input name="email" defaultValue={p.email ?? ""} className="border p-1 w-full" /></label>
                  <label className="text-xs">Company<input name="company" defaultValue={p.company} className="border p-1 w-full" /></label>
                  <label className="text-xs">Stage
                    <select name="stage" defaultValue={p.stage} className="border p-1 w-full">
                      {STAGE_KEYS.map((s) => <option key={s} value={s}>{stageLabels[s] ?? s}</option>)}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  <label className="text-xs" title="Estimated lifetime revenue if this deal closes">Value (est. lifetime rev.)<input type="number" name="dealValue" defaultValue={p.dealValue ?? ""} className="border p-1 w-full" /></label>
                  <label className="text-xs">Audience
                    <select name="audienceId" defaultValue={p.audienceId ?? ""} className="border p-1 w-full">
                      <option value="">— none —</option>
                      {client.audiences.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </label>
                  <label className="text-xs">Call status
                    <select name="callStatus" defaultValue={p.callStatus ?? ""} className="border p-1 w-full">
                      <option value="">— none —</option>
                      {CALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  {p.stage !== "STAGE_1" ? (
                    <label className="text-xs flex items-end gap-1 pb-1"><input type="checkbox" name="qualified" defaultChecked={p.qualified} /> qualified</label>
                  ) : (
                    // qualified only applies once a lead reaches appointment stage; keep the prior value on save
                    <input type="hidden" name="qualified" value={p.qualified ? "on" : ""} />
                  )}
                </div>
                <div className="grid grid-cols-4 gap-1">
                  <label className="text-xs" title="Auto-filled by the tool from the Smartlead reply">Positive reply date (auto)<input type="date" name="positiveReplyDate" defaultValue={p.positiveReplyDate ? p.positiveReplyDate.toISOString().slice(0, 10) : ""} className="border p-1 w-full" /></label>
                  <label className="text-xs">Discovery call<input type="date" name="discoveryCallDate" defaultValue={p.discoveryCallDate ? p.discoveryCallDate.toISOString().slice(0, 10) : ""} className="border p-1 w-full" /></label>
                  <label className="text-xs">Sales call<input type="date" name="salesCallDate" defaultValue={p.salesCallDate ? p.salesCallDate.toISOString().slice(0, 10) : ""} className="border p-1 w-full" /></label>
                  <label className="text-xs">Close date<input type="date" name="closeDate" defaultValue={p.closeDate ? p.closeDate.toISOString().slice(0, 10) : ""} className="border p-1 w-full" /></label>
                </div>
                <div className="grid grid-cols-2 gap-1 items-end">
                  <label className="text-xs">Notes<input name="notes" defaultValue={p.notes ?? ""} className="border p-1 w-full" /></label>
                  <label className="text-xs">Disqualified reason<input name="disqualifiedReason" defaultValue={p.disqualifiedReason ?? ""} className="border p-1 w-full" /></label>
                </div>
                <button className="bg-black text-white px-3 py-1 rounded text-xs mt-1">Save</button>
              </form>
              <form action={deletePipelineEntry.bind(null, id, p.id)} className="mt-1">
                <button className="underline text-red-600 text-xs">delete entry</button>
              </form>
            </div>
          ))}
        </div>
        <form action={boundCreatePipelineEntry} className="grid grid-cols-6 gap-2">
          <input name="contactName" placeholder="Contact name" className="border p-1" required />
          <input name="email" placeholder="Email" className="border p-1" />
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
          <input
            type="number"
            name="dealValue"
            placeholder="Value ⓘ"
            title="Estimated lifetime revenue if this deal closes"
            className="border p-1"
          />
          <button className="bg-black text-white px-3 py-1 rounded col-span-6">Add pipeline entry</button>
        </form>
      </section>

      {/* Milestones */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-3">Milestones</h2>
        <p className="text-gray-500 mb-3">
          <b>State</b> — DONE: already achieved, shows a green checkmark on the client&apos;s timeline.
          CURRENT: the client&apos;s active focus right now, highlighted gold with a pulse on their
          dashboard (usually only one milestone should be CURRENT at a time). NEXT: upcoming, not
          started yet, shown greyed out.
          <br />
          <b>Current value / Target value</b> — only used for count-based milestones (e.g. &quot;15
          qualified appointments&quot;) to show a progress bar. Target = the goal number, Current = how
          far along the client is. Leave both blank for date/event milestones (e.g. &quot;Campaign
          launch&quot;) — no progress bar will show.
        </p>
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
        <p className="text-gray-500 mb-3">
          <b>State</b> — DONE: complete, green checkmark. CURRENT: what the client should be doing right
          now (usually just one step) — shows a &quot;Mark complete&quot; button if &quot;client can
          complete&quot; is checked, otherwise just a CTA link if one is set. ACTIVE: happening in the
          background on Alan&apos;s side, shown as &quot;Underway&quot; (no action needed from the
          client). NEXT: not started yet.
        </p>
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
        <div className="text-gray-500 mb-3 space-y-1">
          <p>
            The metric numbers are always computed live. Here you set the &quot;healthy range&quot; and
            how it scales with the client&apos;s selected time window. &quot;On track&quot; vs
            &quot;needs attention&quot; is then calculated automatically — you never set status by hand.
          </p>
          <p>
            <b>Cadence</b> — <b>Weekly</b>: the Min/Max are a per-week goal (e.g. 5,000 emails/week); it
            auto-expands for longer windows (a month ≈ 4.3× the weekly number). <b>Perpetual</b>: a rate
            or ratio that should always sit in the same range no matter the window (e.g. reply %, emails
            per appointment). <b>Daily</b>: a per-day goal, scaled by number of days.
          </p>
          <p>
            <b>Min / Max</b> — the healthy range at the base unit. Min only = &quot;at least this&quot;
            (emails sent). Max only = &quot;at most this&quot; (emails per booked appt). Both = a band
            (reply % 0.8–1.5). Blank = always &quot;on track.&quot;
          </p>
        </div>
        <div className="grid grid-cols-6 gap-2 py-1 text-xs font-semibold text-gray-500">
          <span>Metric</span>
          <span>Cadence</span>
          <span>Min</span>
          <span>Max</span>
          <span>Tip 1</span>
          <span>Tip 2</span>
        </div>
        {METRIC_KEYS.map((key) => {
          const config = metricConfigByKey.get(key);
          return (
            <form
              key={key}
              action={upsertMetricConfig.bind(null, id, key)}
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

      {/* Documents */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-3">Documents</h2>
        <p className="text-gray-500 mb-3">
          Invoices, contracts, and other official documents the client can view/download. Add a date
          and an optional note that shows when they open it. Max 15 MB per file.
        </p>
        <table className="w-full mb-3">
          <tbody>
            {client.documents.map((d) => (
              <tr key={d.id} className="border-t align-top">
                <td className="py-2">
                  <div className="font-semibold">
                    {d.name} — {d.docDate.toISOString().slice(0, 10)}
                  </div>
                  <div className="text-gray-500 text-xs">{d.fileName}</div>
                  {d.note && <div className="text-gray-600">{d.note}</div>}
                  <div className="flex gap-2 mt-1">
                    <a href={`/api/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">
                      view
                    </a>
                    <a href={`/api/documents/${d.id}?download=1`} className="underline text-blue-600">
                      download
                    </a>
                    <form action={deleteDocument.bind(null, id, d.id)}>
                      <button className="underline text-red-600">delete</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={boundUploadDocument} className="grid grid-cols-2 gap-2">
          <input type="file" name="file" className="border p-1 col-span-2" required />
          <input name="name" placeholder="Title (e.g. 'Setup invoice')" className="border p-1" required />
          <input type="date" name="docDate" className="border p-1" required />
          <input name="note" placeholder="Note shown to client on open (optional)" className="border p-1 col-span-2" />
          <button className="bg-black text-white px-3 py-1 rounded col-span-2">Upload document</button>
        </form>
      </section>

      {/* Changelog (v1.1) */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-3">Long-term notes / changelog</h2>
        <p className="text-gray-500 mb-3">
          Client-visible (their &quot;Changelog&quot; tab), but framed as mostly-internal tracking — use
          it to log when you launched/bought/changed something for this client.
        </p>
        <table className="w-full mb-3">
          <tbody>
            {client.changelog.map((e) => (
              <tr key={e.id} className="border-t align-top">
                <td className="py-2">
                  <div className="font-semibold">{e.title} — {e.date.toISOString().slice(0, 10)}</div>
                  {e.body && <div className="text-gray-600">{e.body}</div>}
                  <form action={deleteChangelogEntry.bind(null, id, e.id)}>
                    <button className="underline text-red-600 text-xs mt-1">delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={boundCreateChangelogEntry} className="grid grid-cols-2 gap-2">
          <input type="date" name="date" className="border p-1" required />
          <input name="title" placeholder="Title (e.g. 'Bought 8 new domains')" className="border p-1" required />
          <textarea name="body" placeholder="Details (optional)" className="border p-1 col-span-2" />
          <button className="bg-black text-white px-3 py-1 rounded col-span-2">Add entry</button>
        </form>
      </section>
    </div>
  );
}
