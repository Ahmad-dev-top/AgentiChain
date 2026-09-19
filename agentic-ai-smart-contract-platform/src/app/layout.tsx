import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentiChain — Autonomous Multi-Agent Smart Contract Orchestration & Verification Platform",
  description: "Design, formally verify, audit, simulate, deploy, and autonomously manage production-grade smart contracts using multi-agent AI workflows.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#070b14] text-slate-100 antialiased">{children}</body>
    </html>
  );
}
