import { requireClientType } from "@/lib/dashboard-scope";
import { prisma } from "@/lib/prisma";
import { getContent } from "@/lib/content";
import { EditProvider } from "@/components/ls/EditProvider";
import { E } from "@/components/ls/Editable";

// Tasks/submissions are Phase 5. The accounts card below is live now
// because it's what a client actually needs the moment an LSA lead lands:
// where to sign in to reply and unlock the customer's details.
const LSA_URL = "https://ads.google.com/local-services-ads";
const LSA_SIGN_IN_EMAIL = "canenciapainting@gmail.com";

export default async function NextStepsPage() {
  const scope = await requireClientType("LOCAL_SERVICES");
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: scope.clientId },
    select: { id: true },
  });
  const content = await getContent(client.id);

  return (
    <EditProvider clientId={client.id} canEdit={scope.isPreview}>
      <div className="wa-page-head">
        <div>
          <div className="wa-eyebrow">Your side of it</div>
          <h1 className="wa-page-title">What I need from you</h1>
          <div className="wa-page-sub">
            Everything I need on your end, in one place — so you never have to dig through texts or emails to
            find it.
          </div>
        </div>
      </div>

      <div className="wa-card">
        <div className="wa-empty">
          <div className="wa-empty-mark">◇</div>
          <p>
            <b>Nothing needed from you right now.</b>
          </p>
          <p>
            When there&apos;s something that would genuinely move things forward — customer names for review
            requests, photos from a finished job, a follow-up worth chasing — it&apos;ll show up here, and
            you&apos;ll be able to reply or upload straight into the page.
          </p>
        </div>
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
          <E
            k="ask.accounts.passwordNote"
            v={content.text("ask.accounts.passwordNote")}
            label="Password note"
          />
        </p>
      </div>
    </EditProvider>
  );
}
