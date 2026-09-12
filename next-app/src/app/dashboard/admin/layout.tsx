import { redirect } from "next/navigation";
import { getSession } from "@/server/auth";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!ADMIN_ROLES.includes(session.role)) redirect("/dashboard");
  return <>{children}</>;
}
