import type { Metadata } from "next";
import { TrackView } from "./track-view";

export const metadata: Metadata = { title: "Track a grievance" };

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return <TrackView initialCode={code ?? ""} />;
}
