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
