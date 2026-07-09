import { prisma } from "@/lib/prisma";

export default async function AdminHome() {
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="p-8 text-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin — Clients</h1>
        <a href="/admin/clients/new" className="bg-black text-white px-3 py-1 rounded">
          + New client
        </a>
      </div>
      <ul className="mt-4 space-y-2">
        {clients.map((c) => (
          <li key={c.id} className="border p-3 rounded">
            <a href={`/admin/clients/${c.id}`} className="text-blue-600 underline font-medium">
              {c.name}
            </a>{" "}
            ({c.slug}) — {c.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
