import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { getScopedContext } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getScopedContext();

  if (ctx.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="flex justify-end px-8 pt-4 text-sm">
        <SignOutButton redirectUrl="/sign-in">
          <button className="text-blue-600 underline">Sign out</button>
        </SignOutButton>
      </div>
      {children}
    </div>
  );
}
