export type PipelineLeadVM = {
  contactName: string;
  company: string;
  displayValue: string;
};

export type PipelineStageVM = {
  key: string;
  label: string;
  count: number;
  note: string;
  leads: PipelineLeadVM[];
};

export function Pipeline({
  stages,
  totalValue,
  isEmpty,
}: {
  stages: PipelineStageVM[];
  totalValue: number;
  isEmpty: boolean;
}) {
  return (
    <div className="wa-card">
      <div className="wa-section-head">
        <div>
          <div className="wa-eyebrow">Pipeline</div>
          <h2 className="wa-h2">From reply to funded deal</h2>
        </div>
        {!isEmpty && totalValue > 0 && (
          <div className="wa-pipe-total">
            Est. pipeline value <b>${Math.round(totalValue / 1000).toLocaleString("en-US")}K</b>
          </div>
        )}
      </div>

      {isEmpty ? (
        <div className="wa-empty">
          <div className="wa-empty-mark">◇</div>
          <p>
            <b>Your pipeline builds here after launch.</b>
          </p>
          <p>
            Once the campaign goes live, every positive reply, booked appointment, and held
            appointment appears in this view — with estimated deal value attached.
          </p>
        </div>
      ) : (
        <div className="wa-pipe-grid">
          {stages.map((s, i) => {
            // Stage 1 (raw positive replies) is de-emphasized — it's
            // noisy/unvetted compared to booked/held/closed, especially
            // now that it can be auto-populated from Smartlead replies.
            const isRawRepliesStage = i === 0;
            const visibleLeads = isRawRepliesStage ? s.leads.slice(0, 3) : s.leads;
            const hiddenCount = s.leads.length - visibleLeads.length;
            return (
              <div key={s.key} className={`wa-stage ${isRawRepliesStage ? "wa-stage-muted" : ""}`}>
                <div className="wa-stage-head">
                  <span className="wa-stage-name">{s.label}</span>
                  {i < stages.length - 1 && <span className="wa-stage-arrow">→</span>}
                </div>
                <div className="wa-stage-count">{s.count}</div>
                <div className="wa-stage-note">{s.note}</div>
                <div className="wa-stage-leads">
                  {visibleLeads.map((l, li) => (
                    <div key={li} className="wa-lead">
                      <div>
                        <div className="wa-lead-name">{l.contactName}</div>
                        <div className="wa-lead-co">{l.company}</div>
                      </div>
                      <div className="wa-lead-val">{l.displayValue}</div>
                    </div>
                  ))}
                  {hiddenCount > 0 && (
                    <div className="wa-stage-more">+{hiddenCount} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
