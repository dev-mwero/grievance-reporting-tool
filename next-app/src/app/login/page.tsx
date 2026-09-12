import type { Metadata } from "next";
import { LoginView } from "./login-view";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ invited?: string }>;
}) {
  const { invited } = await searchParams;
  return <LoginView invited={invited === "1"} />;
}
