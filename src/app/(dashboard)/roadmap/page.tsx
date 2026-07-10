import { getDashboardScope } from "@/lib/dashboard-scope";
import { getDashboardClient } from "@/lib/dashboard-data";
import { computeMilestones, computeOnboarding } from "@/lib/dashboard-compute";
import { Journey } from "@/components/dashboard/Journey";
import { Onboarding } from "@/components/dashboard/Onboarding";
import { completeOnboardingStep } from "../actions";

export default async function RoadmapPage() {
  const scope = await getDashboardScope();
  const client = await getDashboardClient(scope.clientId);

  const milestones = computeMilestones(client);
  const onboarding = computeOnboarding(client);

  return (
    <>
      <div className="wa-page-head">
        <div>
          <h1 className="wa-page-title">Roadmap</h1>
          <div className="wa-page-sub">Timeline, milestones, and required client actions.</div>
        </div>
      </div>

      <Journey milestones={milestones} />
      <Onboarding steps={onboarding} onComplete={completeOnboardingStep} />
    </>
  );
}
