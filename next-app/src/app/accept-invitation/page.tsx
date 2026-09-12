import type { Metadata } from "next";
import { AcceptInvitationView } from "./accept-invitation-view";

export const metadata: Metadata = { title: "Accept invitation" };

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <AcceptInvitationView token={token ?? ""} />;
}
