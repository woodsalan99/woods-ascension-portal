import { prisma } from "@/lib/prisma";

export default async function AdminHome() {
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Admin — Clients</h1>
      <ul className="mt-4 space-y-2">
        {clients.map((c) => (
          <li key={c.id} className="border p-3 rounded">
            {c.name} ({c.slug}) — {c.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
