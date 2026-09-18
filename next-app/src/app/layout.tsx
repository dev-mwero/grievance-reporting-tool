import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { PublicHeader } from "@/components/public-header";
import { getSession } from "@/server/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "GriPo — Grievance Portal",
    template: "%s · GriPo",
  },
  description:
    "A transparent platform for submitting, tracking and resolving public grievances.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers initialUser={session}>
          <PublicHeader />
          <main className="flex-1">{children}</main>
          <footer className="border-t bg-card">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
              <span>© {new Date().getFullYear()} GriPo</span>
              <span>Submitting a grievance has never been easier</span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
