import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      {/* Nav */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">
            Arbitrage Scanner
          </span>
          <nav className="flex items-center gap-6 text-sm">
            <a href="#how-it-works" className="text-slate-600 hover:text-slate-900">
              How it works
            </a>
            <a href="#pricing" className="text-slate-600 hover:text-slate-900">
              Pricing
            </a>
            <Link
              href="/dashboard"
              className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700"
            >
              Open dashboard
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
            Live crypto scanning &middot; more markets coming online
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Find real price gaps, verified before you see them.
          </h1>
          <p className="mt-6 text-lg text-slate-600">
            Arbitrage Scanner is an AI-agent-powered system that continuously
            watches crypto exchanges for price discrepancies &mdash; and, as
            more data sources come online, sports betting odds and retail
            prices too. Every opportunity you see has already been checked
            against real fees and data freshness, not just a raw price
            difference.
          </p>
          <div className="mt-8 flex gap-4">
            <Link
              href="/dashboard"
              className="rounded-md bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-700"
            >
              View live opportunities
            </Link>
            <a
              href="#how-it-works"
              className="rounded-md border border-slate-300 px-5 py-3 font-medium text-slate-700 hover:bg-slate-100"
            >
              How it works
            </a>
          </div>
        </div>
      </section>

      {/* How it works / two-agent architecture */}
      <section id="how-it-works" className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl font-semibold text-slate-900">
            Two agents, so you only see opportunities worth acting on
          </h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            Raw price differences between sources are noisy and often
            illusory once you account for fees, stale quotes, or thin order
            books. We split the work across two independent agents so bad
            signals get filtered out before they reach the dashboard.
          </p>

          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-6">
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                1
              </div>
              <h3 className="text-lg font-medium text-slate-900">
                The Scanner agent
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Continuously polls prices across crypto exchanges (and, as
                they come online, sports betting odds and retail listings) to
                find candidate spreads &mdash; pairs of sources quoting the
                same thing at meaningfully different prices right now.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-6">
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                2
              </div>
              <h3 className="text-lg font-medium text-slate-900">
                The Validator agent
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Independently re-checks every candidate: real trading fees,
                how fresh each quote is, and how confident we should be that
                the spread is actually capturable. Only spreads that clear
                these checks show up as opportunities.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-5">
              <h4 className="font-medium text-slate-900">Crypto &mdash; live</h4>
              <p className="mt-1 text-sm text-slate-600">
                Multiple major exchanges scanned continuously.
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-5">
              <h4 className="font-medium text-slate-900">
                Sports betting &mdash; coming online
              </h4>
              <p className="mt-1 text-sm text-slate-600">
                Odds feeds are being connected; expect sparse results for now.
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-5">
              <h4 className="font-medium text-slate-900">
                Retail &mdash; coming online
              </h4>
              <p className="mt-1 text-sm text-slate-600">
                Price feeds are being connected; expect sparse results for now.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing (placeholder) */}
      <section id="pricing" className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl font-semibold text-slate-900">Pricing</h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            Billing isn&apos;t live yet. The plans below are placeholders so
            you know what&apos;s planned &mdash; nothing here is purchasable
            today.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 sm:max-w-2xl">
            <div className="rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-medium text-slate-900">Free</h3>
              <p className="mt-1 text-3xl font-semibold text-slate-900">$0</p>
              <p className="mt-2 text-sm text-slate-600">
                Live dashboard access to currently supported markets.
              </p>
              <ul className="mt-4 space-y-1 text-sm text-slate-600">
                <li>Crypto opportunities</li>
                <li>10&ndash;15s refresh</li>
              </ul>
            </div>
            <div className="relative rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6">
              <span className="absolute right-4 top-4 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
                Placeholder
              </span>
              <h3 className="text-lg font-medium text-slate-900">
                Pro &mdash; Coming soon
              </h3>
              <p className="mt-1 text-3xl font-semibold text-slate-400">
                Pricing TBD
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Planned: faster refresh, all markets, alerting. Billing is
                not wired up yet &mdash; this card is a placeholder for what&apos;s
                coming, not a purchasable plan.
              </p>
              <button
                type="button"
                disabled
                className="mt-4 w-full cursor-not-allowed rounded-md bg-slate-300 px-4 py-2 text-sm font-medium text-slate-500"
              >
                Not available yet
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-slate-500">
          Arbitrage Scanner &mdash; informational tool, not financial advice.
        </div>
      </footer>
    </main>
  );
}
