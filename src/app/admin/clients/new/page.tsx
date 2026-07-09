import { redirect } from "next/navigation";
import { createClient } from "../[id]/actions";

async function createAndRedirect(formData: FormData) {
  "use server";
  const id = await createClient(formData);
  redirect(`/admin/clients/${id}`);
}

export default function NewClientPage() {
  return (
    <div className="p-8 max-w-md mx-auto text-sm">
      <a href="/admin" className="text-blue-600 underline">← All clients</a>
      <h1 className="text-xl font-bold mt-2 mb-4">New client</h1>
      <form action={createAndRedirect} className="flex flex-col gap-3">
        <label>Name<input name="name" className="border w-full p-1" required /></label>
        <label>Slug<input name="slug" className="border w-full p-1" required /></label>
        <label>Timezone<input name="timezone" defaultValue="America/New_York" className="border w-full p-1" /></label>
        <button className="bg-black text-white py-1 rounded">Create</button>
      </form>
    </div>
  );
}
