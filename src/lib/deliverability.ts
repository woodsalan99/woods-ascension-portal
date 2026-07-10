import type { DomainHealth } from "@/lib/smartlead";

export type DomainStatus = "GREEN" | "YELLOW" | "RED" | "INSUFFICIENT";

// Minimum sends in the recent window for the reply/bounce signal to be
// statistically meaningful — small samples are noise.
export const MIN_SENDS_FOR_SIGNAL = 100;

export type DomainRowVM = {
  domain: string;
  status: DomainStatus;
  reason: string;
  recentSent: number;
  recentReplyRate: number;
  recentBounceRate: number;
  priorReplyRate: number;
  priorBounceRate: number;
};

// Thresholds (Alan's spec):
//   YELLOW: reply rate >20% lower OR bounce rate >30% higher than prior window
//   RED:    reply rate >40% lower OR bounce rate >40% higher
// Only judged when the recent window has >= MIN_SENDS_FOR_SIGNAL sends.
export function evaluateDomain(recent: DomainHealth | undefined, prior: DomainHealth | undefined): DomainRowVM {
  const recentSent = recent?.sent ?? 0;
  const recentReplyRate = recent?.replyRate ?? 0;
  const recentBounceRate = recent?.bounceRate ?? 0;
  const priorReplyRate = prior?.replyRate ?? 0;
  const priorBounceRate = prior?.bounceRate ?? 0;

  const base = {
    domain: recent?.domain ?? prior?.domain ?? "",
    recentSent,
    recentReplyRate,
    recentBounceRate,
    priorReplyRate,
    priorBounceRate,
  };

  if (recentSent < MIN_SENDS_FOR_SIGNAL) {
    return { ...base, status: "INSUFFICIENT", reason: `Needs ${MIN_SENDS_FOR_SIGNAL}+ sends (has ${recentSent})` };
  }

  // Reply-rate drop as a fraction of the prior rate.
  const replyDrop = priorReplyRate > 0 ? (priorReplyRate - recentReplyRate) / priorReplyRate : 0;
  // Bounce increase as a fraction of the prior rate; if prior was ~0, treat
  // any material new bounce (>=2%) as a strong increase.
  const bounceIncrease =
    priorBounceRate > 0
      ? (recentBounceRate - priorBounceRate) / priorBounceRate
      : recentBounceRate >= 2
        ? Infinity
        : 0;

  if (replyDrop > 0.4 || bounceIncrease > 0.4) {
    const why = replyDrop > 0.4 ? `reply rate down ${Math.round(replyDrop * 100)}%` : `bounce rate up sharply`;
    return { ...base, status: "RED", reason: `Likely compromised — ${why}` };
  }
  if (replyDrop > 0.2 || bounceIncrease > 0.3) {
    const why = replyDrop > 0.2 ? `reply rate down ${Math.round(replyDrop * 100)}%` : `bounce rate rising`;
    return { ...base, status: "YELLOW", reason: `Potential slowdown — ${why}` };
  }
  return { ...base, status: "GREEN", reason: "Healthy" };
}

export function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

// ---- View #2: domain-vs-client-average divergence ----
// Since a domain serves exactly one client (but is shared across that
// client's campaigns), the meaningful comparison is a domain against its
// client's overall rates. A domain far below the client's average reply
// rate — or far above its bounce rate — is a strong "this domain is hit"
// signal, because the client's *other* domains (same copy/offer) are fine.

export type DivergenceStatus = "OK" | "UNDERPERFORMING" | "LIKELY_HIT";

export type DivergenceVM = {
  domain: string;
  sent: number;
  replyRate: number;
  bounceRate: number;
  status: DivergenceStatus;
  reason: string;
};

export function evaluateDivergence(params: {
  domain: string;
  sent: number;
  replyRate: number;
  bounceRate: number;
  clientReplyRate: number;
  clientBounceRate: number;
}): DivergenceVM {
  const { domain, sent, replyRate, bounceRate, clientReplyRate, clientBounceRate } = params;
  const base = { domain, sent, replyRate, bounceRate };

  if (sent < MIN_SENDS_FOR_SIGNAL) {
    return { ...base, status: "OK", reason: `Needs ${MIN_SENDS_FOR_SIGNAL}+ sends` };
  }

  // Reply comparison only meaningful when the client actually gets replies.
  const replyRatio = clientReplyRate > 0.5 ? replyRate / clientReplyRate : null;
  // Bounce comparison: how far above the client's typical bounce rate.
  const bounceHigh2x = bounceRate >= Math.max(clientBounceRate * 2, clientBounceRate + 2);
  const bounceHigh3x = bounceRate >= Math.max(clientBounceRate * 3, clientBounceRate + 3);

  if ((replyRatio !== null && replyRatio <= 0.35) || bounceHigh3x) {
    const why =
      replyRatio !== null && replyRatio <= 0.35
        ? `reply rate ${replyRate.toFixed(1)}% vs client avg ${clientReplyRate.toFixed(1)}%`
        : `bounce rate ${bounceRate.toFixed(1)}% vs client avg ${clientBounceRate.toFixed(1)}%`;
    return { ...base, status: "LIKELY_HIT", reason: `Likely hit — ${why}` };
  }
  if ((replyRatio !== null && replyRatio <= 0.6) || bounceHigh2x) {
    const why =
      replyRatio !== null && replyRatio <= 0.6
        ? `reply rate below client average`
        : `bounce rate above client average`;
    return { ...base, status: "UNDERPERFORMING", reason: `Underperforming — ${why}` };
  }
  return { ...base, status: "OK", reason: "In line with client average" };
}
