import { requireClientType } from "@/lib/dashboard-scope";
import { prisma } from "@/lib/prisma";
import { getContent } from "@/lib/content";
import { getScopedContext } from "@/lib/auth";
import { EditProvider } from "@/components/ls/EditProvider";
import { E, EList } from "@/components/ls/Editable";
import { TaskList, type TaskVM } from "@/components/ls/TaskList";
import { ReviewRequestForm } from "@/components/ls/ReviewRequestForm";

// The accounts card is what a client needs the moment an LSA lead lands:
// where to sign in to reply and unlock the customer's details.
const LSA_URL = "https://ads.google.com/local-services-ads";
const LSA_SIGN_IN_EMAIL = "canenciapainting@gmail.com";

// Weekly habits are stored as one pipe-separated string per item so Alan can
// add, remove and reorder them from edit mode without a schema change:
//   icon|heading|body|why it matters
function splitHabit(raw: string) {
  const [icon = "•", heading = "", body = "", why = ""] = raw.split("|");
  return { icon, heading, body, why };
}

export default async function NextStepsPage() {
  const scope = await requireClientType("LOCAL_SERVICES");
  const ctx = await getScopedContext();
  const content = await getContent(scope.clientId);

  const [tasks, reviewRequests] = await Promise.all([
    prisma.clientTask.findMany({
      where: { clientId: scope.clientId },
      orderBy: { sortOrder: "asc" },
      include: { submissions: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.reviewRequest.findMany({
      where: { clientId: scope.clientId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  // Ticked-off items drop to the bottom rather than vanishing — a client who
  // ticks the wrong thing needs to see where it went.
  const taskVMs: TaskVM[] = tasks
    .slice()
    .sort((a, b) => Number(a.status === "DONE") - Number(b.status === "DONE"))
    .map((t) => ({
      id: t.id,
      title: t.title,
      explanation: t.explanation,
      urgency: t.urgency,
      responseType: t.responseType,
      done: t.status === "DONE",
      // Each person edits their own written answer; photos are shared, because
      // a job photo belongs to the business, not to whoever happened to upload it.
      text: t.submissions.find((s) => s.kind === "TEXT" && s.submittedByUserId === ctx.userId)?.textValue ?? "",
      photos: t.submissions
        .filter((s) => s.kind === "PHOTO" && s.fileData !== null)
        .map((s) => ({ id: s.id, fileName: s.fileName })),
    }));

  const openCount = taskVMs.filter((t) => !t.done).length;
  const habits = content.list("ask.habits.items");

  return (
    <EditProvider clientId={scope.clientId} canEdit={scope.isPreview}>
      <div className="wa-page-head">
        <div>
          <div className="wa-eyebrow">
            <E k="ask.eyebrow" v={content.text("ask.eyebrow")} label="Next steps eyebrow" />
          </div>
          <h1 className="wa-page-title">
            <E k="ask.title" v={content.text("ask.title")} label="Next steps title" />
          </h1>
          <div className="wa-page-sub">
            <E k="ask.sub" v={content.text("ask.sub")} label="Next steps subtitle" multiline />
          </div>
        </div>
        <span className={`wa-pill ${openCount > 0 ? "wait" : "live"}`}>
          {openCount === 0 ? "All caught up" : openCount === 1 ? "1 thing open" : `${openCount} things open`}
        </span>
      </div>

      <div className="wa-card">
        <div className="wa-section-head">
          <div>
            <h2 className="wa-h2">
              <E k="ask.now.title" v={content.text("ask.now.title")} label="Right now — heading" />
            </h2>
            <p className="wa-page-sub">
              <E k="ask.now.sub" v={content.text("ask.now.sub")} label="Right now — subtitle" multiline />
            </p>
          </div>
        </div>
        <TaskList tasks={taskVMs} />
      </div>

      <div className="wa-card">
        <div className="wa-section-head">
          <div>
            <div className="wa-eyebrow">
              <E k="ask.reviews.label" v={content.text("ask.reviews.label")} label="Reviews label" />
            </div>
            <h2 className="wa-h2">
              <E k="ask.reviews.title" v={content.text("ask.reviews.title")} label="Reviews title" />
            </h2>
            <p className="wa-page-sub">
              <E k="ask.reviews.sub" v={content.text("ask.reviews.sub")} label="Reviews subtitle" multiline />
            </p>
          </div>
        </div>

        <ReviewRequestForm />

        <div className="wa-review-list">
          {reviewRequests.length === 0 ? (
            <div className="wa-empty wa-empty-slim">
              <p>
                <E k="ask.reviews.empty" v={content.text("ask.reviews.empty")} label="Reviews empty state" />
              </p>
            </div>
          ) : (
            reviewRequests.map((r) => (
              <div key={r.id} className="wa-review-row">
                <div>
                  <div className="wa-review-who">{r.customerName}</div>
                  <div className="wa-review-when">
                    {r.phone} · added{" "}
                    {r.createdAt.toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                </div>
                <span className={`wa-pill ${r.status === "REVIEWED" ? "live" : r.status === "QUEUED" ? "wait" : ""}`}>
                  {r.status === "QUEUED"
                    ? "With us"
                    : r.status === "SENT"
                      ? "Asked"
                      : r.status === "REMINDED"
                        ? "Reminded"
                        : r.status === "REVIEWED"
                          ? "Left a review"
                          : "Closed out"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="wa-card">
        <div className="wa-section-head">
          <div>
            <div className="wa-eyebrow">
              <E k="ask.habits.label" v={content.text("ask.habits.label")} label="Habits label" />
            </div>
            <h2 className="wa-h2">
              <E k="ask.habits.title" v={content.text("ask.habits.title")} label="Habits title" />
            </h2>
            <p className="wa-page-sub">
              <E k="ask.habits.sub" v={content.text("ask.habits.sub")} label="Habits subtitle" multiline />
            </p>
          </div>
        </div>

        {scope.isPreview ? (
          // Edit mode works on the raw pipe-separated strings; clients never see them.
          <EList
            k="ask.habits.items"
            items={habits}
            label="Weekly habits"
            itemLabel="Habit (icon|heading|body|why it matters)"
          />
        ) : (
          <div>
            {habits.map((raw, i) => {
              const h = splitHabit(raw);
              return (
                <div key={i} className="wa-habit">
                  <div className="wa-habit-ico">{h.icon}</div>
                  <div>
                    <b>{h.heading}</b>
                    <p>{h.body}</p>
                    {h.why && <div className="wa-habit-why">{h.why}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="wa-card">
        <div className="wa-section-head">
          <div>
            <div className="wa-eyebrow">
              <E k="ask.accounts.label" v={content.text("ask.accounts.label")} label="Accounts eyebrow" />
            </div>
            <h2 className="wa-h2">
              <E k="ask.accounts.title" v={content.text("ask.accounts.title")} label="Accounts title" />
            </h2>
          </div>
        </div>

        <div className="wa-account-row">
          <div className="wa-account-main">
            <div className="wa-account-name">
              <E k="ask.accounts.lsa.name" v={content.text("ask.accounts.lsa.name")} label="LSA account name" />
            </div>
            <div className="wa-account-meta">
              Sign in with <b>{LSA_SIGN_IN_EMAIL}</b>
            </div>
            <div className="wa-account-what">
              <E k="ask.accounts.lsa.what" v={content.text("ask.accounts.lsa.what")} label="LSA account contents" />
            </div>
            <div className="wa-account-why">
              <E k="ask.accounts.lsa.why" v={content.text("ask.accounts.lsa.why")} label="LSA account why it matters" />
            </div>
          </div>
          <a className="wa-doc-btn" href={LSA_URL} target="_blank" rel="noopener noreferrer">
            Open →
          </a>
        </div>

        <p className="wa-page-sub" style={{ marginTop: 16 }}>
          <E k="ask.accounts.passwordNote" v={content.text("ask.accounts.passwordNote")} label="Password note" />
        </p>
      </div>
    </EditProvider>
  );
}
