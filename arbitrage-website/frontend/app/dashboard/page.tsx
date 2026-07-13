import Link from "next/link";
import DashboardClient from "@/components/DashboardClient";

export const metadata = {
  title: "Dashboard — Arbitrage Scanner",
};

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
            &larr; Back to overview
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Live opportunities
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Validated arbitrage opportunities, refreshed automatically.
          </p>
        </div>
      </div>
      <DashboardClient />
    </main>
  );
}
