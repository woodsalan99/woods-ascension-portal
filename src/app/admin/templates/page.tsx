import { prisma } from "@/lib/prisma";
import { createTemplate, deleteTemplate } from "./actions";

export default async function TemplatesPage() {
  const templates = await prisma.template.findMany({
    orderBy: { createdAt: "asc" },
    include: { steps: true, metrics: true, milestones: true },
  });

  return (
    <div className="p-8 text-sm max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Templates</h1>
        <a href="/admin" className="text-blue-600 underline">
          ← Back to clients
        </a>
      </div>
      <p className="text-gray-500 mb-4">
        Define a reusable set of roadmap steps, metric KPIs, and milestones once, then apply it to any
        client in one click from that client&apos;s page instead of hand-authoring it every time.
      </p>

      <ul className="space-y-2 mb-6">
        {templates.map((t) => (
          <li key={t.id} className="border p-3 rounded flex items-center justify-between">
            <a href={`/admin/templates/${t.id}`} className="text-blue-600 underline font-medium">
              {t.name}
            </a>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>
                {t.steps.length} steps · {t.metrics.length} metrics · {t.milestones.length} milestones
              </span>
              <form action={deleteTemplate.bind(null, t.id)}>
                <button className="underline text-red-600">delete</button>
              </form>
            </div>
          </li>
        ))}
        {templates.length === 0 && <li className="text-gray-500">No templates yet.</li>}
      </ul>

      <form
        action={async (formData: FormData) => {
          "use server";
          const id = await createTemplate(formData);
          const { redirect } = await import("next/navigation");
          redirect(`/admin/templates/${id}`);
        }}
        className="flex gap-2"
      >
        <input name="name" placeholder="Template name (e.g. Standard Onboarding)" className="border p-1 flex-1" required />
        <button className="bg-black text-white px-3 py-1 rounded">Create template</button>
      </form>
    </div>
  );
}
