const SMARTLEAD_BASE = "https://server.smartlead.ai/api/v1";

function apiKey() {
  const key = process.env.SMARTLEAD_API_KEY;
  if (!key) throw new Error("SMARTLEAD_API_KEY not configured");
  return key;
}

export type DomainHealth = {
  domain: string;
  sent: number;
  replied: number;
  bounced: number;
  replyRate: number; // percent
  bounceRate: number; // percent
};

// Account-wide reply/bounce per sending domain for a date window. Since a
// domain serves exactly one client, its account-wide numbers already reflect
// only that client's sending.
export async function fetchDomainHealth(startDate: string, endDate: string): Promise<DomainHealth[]> {
  const res = await fetch(
    `${SMARTLEAD_BASE}/analytics/mailbox/domain-wise-health-metrics?api_key=${apiKey()}&start_date=${startDate}&end_date=${endDate}`,
  );
  if (!res.ok) throw new Error(`fetchDomainHealth failed: ${res.status}`);
  const json = (await res.json()) as {
    data?: { domain_health_metrics?: Array<Record<string, string>> };
  };
  const rows = json.data?.domain_health_metrics ?? [];
  return rows.map((r) => {
    const sent = Number(r.sent ?? 0);
    const replied = Number(r.replied ?? 0);
    const bounced = Number(r.bounced ?? 0);
    // Compute rates from counts — the API's reply_rate/bounce_rate strings
    // aren't reliably populated on this endpoint.
    return {
      domain: r.domain,
      sent,
      replied,
      bounced,
      replyRate: sent > 0 ? (replied / sent) * 100 : 0,
      bounceRate: sent > 0 ? (bounced / sent) * 100 : 0,
    };
  });
}

export type DomainMeta = { domain: string; inboxCount: number; oldestCreatedAt: string };

// Aggregates the email-account list into per-domain inbox counts + age
// (oldest inbox). Paginates since accounts can exceed one page.
export async function fetchDomainInboxMeta(): Promise<Map<string, DomainMeta>> {
  const byDomain = new Map<string, DomainMeta>();
  const limit = 100;
  let offset = 0;

  while (true) {
    const res = await fetch(
      `${SMARTLEAD_BASE}/email-accounts/?api_key=${apiKey()}&offset=${offset}&limit=${limit}`,
    );
    if (!res.ok) throw new Error(`fetchDomainInboxMeta failed: ${res.status}`);
    const accounts = (await res.json()) as Array<{ from_email: string; created_at: string }>;
    if (!Array.isArray(accounts) || accounts.length === 0) break;

    for (const a of accounts) {
      const domain = a.from_email?.split("@")[1]?.toLowerCase();
      if (!domain) continue;
      const existing = byDomain.get(domain);
      if (!existing) {
        byDomain.set(domain, { domain, inboxCount: 1, oldestCreatedAt: a.created_at });
      } else {
        existing.inboxCount += 1;
        if (a.created_at < existing.oldestCreatedAt) existing.oldestCreatedAt = a.created_at;
      }
    }

    if (accounts.length < limit) break;
    offset += limit;
    await new Promise((r) => setTimeout(r, 200));
  }

  return byDomain;
}

export type LeadCategory = {
  id: number;
  name: string;
  sentimentType: "positive" | "negative" | null;
};

export type SmartleadCampaignSummary = {
  id: number;
  name: string;
  status: string;
};

// Used by the admin campaign-picker autocomplete — not cached, always the
// live account list, so admins see campaigns created moments ago.
export async function fetchAllCampaigns(): Promise<SmartleadCampaignSummary[]> {
  const res = await fetch(`${SMARTLEAD_BASE}/campaigns?api_key=${apiKey()}`);
  if (!res.ok) {
    throw new Error(`fetchAllCampaigns failed: ${res.status}`);
  }
  const data = (await res.json()) as Array<{ id: number; name: string; status: string }>;
  return data.map((c) => ({ id: c.id, name: c.name, status: c.status }));
}

export async function fetchLeadCategories(): Promise<LeadCategory[]> {
  const res = await fetch(
    `${SMARTLEAD_BASE}/leads/fetch-categories?api_key=${apiKey()}`,
  );
  if (!res.ok) {
    throw new Error(`fetchLeadCategories failed: ${res.status}`);
  }
  const data = (await res.json()) as Array<{
    id: number;
    name: string;
    sentiment_type: "positive" | "negative" | null;
  }>;
  return data.map((c) => ({
    id: c.id,
    name: c.name,
    sentimentType: c.sentiment_type,
  }));
}

export type CampaignStatRecord = {
  leadEmail: string;
  leadName: string | null;
  leadCategory: string | null;
  sentTime: string | null;
  replyTime: string | null;
  isBounced: boolean;
};

// Smartlead paginates /campaigns/{id}/statistics; total_stats tells us when
// to stop. 250ms delay between pages per §7 rate-limit note.
export async function fetchCampaignStatistics(
  smartleadCampaignId: string,
): Promise<CampaignStatRecord[]> {
  const limit = 500;
  let offset = 0;
  const all: CampaignStatRecord[] = [];

  while (true) {
    const res = await fetch(
      `${SMARTLEAD_BASE}/campaigns/${smartleadCampaignId}/statistics?api_key=${apiKey()}&offset=${offset}&limit=${limit}`,
    );
    if (!res.ok) {
      throw new Error(
        `fetchCampaignStatistics failed for campaign ${smartleadCampaignId}: ${res.status}`,
      );
    }
    const json = (await res.json()) as {
      total_stats: string;
      data: Array<{
        lead_email: string;
        lead_name: string | null;
        lead_category: string | null;
        sent_time: string | null;
        reply_time: string | null;
        is_bounced: boolean;
      }>;
    };

    all.push(
      ...json.data.map((r) => ({
        leadEmail: r.lead_email,
        leadName: r.lead_name,
        leadCategory: r.lead_category,
        sentTime: r.sent_time,
        replyTime: r.reply_time,
        isBounced: r.is_bounced,
      })),
    );

    const total = Number(json.total_stats);
    offset += limit;
    if (offset >= total || json.data.length === 0) break;

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return all;
}
