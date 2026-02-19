import Link from "next/link";
import { HeroCanvas } from "@/components/landing/hero-canvas";
import { Reveal } from "@/components/landing/reveal";

const VIEWS = [
  {
    name: "River",
    desc: "The chronological flow of observations. See everything your team has noticed, flowing through time.",
    color: "var(--color-cool-1)",
  },
  {
    name: "Constellation",
    desc: "The relationship map. Observations positioned by similarity, revealing clusters you'd never see in a list.",
    color: "var(--color-warm-3)",
  },
  {
    name: "Signal Landscape",
    desc: "The terrain of emerging meaning. Watch signals rise and fall like a living topography.",
    color: "var(--color-warm-1)",
  },
  {
    name: "Sentiment",
    desc: "The temperature of things. Warm means energy. Cool means reflection. Neither is better.",
    color: "var(--color-cool-3)",
  },
];

const ENVIRONMENTS = [
  {
    name: "Stars",
    bg: "#0A0E1A",
    metaphor:
      "Observations as stars in a night sky. Signals as constellations. Discovery in infinite space.",
    bestFor: "Exploratory sensing. Systems change. Looking for what's emerging.",
    dots: ["#FF6B4A", "#FFD166", "#45B7D1", "#6C5CE7"],
  },
  {
    name: "Water",
    bg: "#071E22",
    metaphor:
      "Observations as droplets feeding a river. Signals as currents and eddies beneath the surface.",
    bestFor: "Ongoing culture work. Tracking the continuous flow of experience.",
    dots: ["#4ECDC4", "#2AB7CA", "#45B7D1", "#3D5A80"],
  },
  {
    name: "Mycelium",
    bg: "#0D1B0E",
    metaphor:
      "Observations as nutrients. Signals as underground networks connecting what seems separate.",
    bestFor: "Partnership work. Ecosystem sensing. Place-based initiatives.",
    dots: ["#E8B960", "#C4A35A", "#73956F", "#4A7C59"],
  },
];

const USE_CASES = [
  {
    name: "Individual learning",
    desc: "A reflective practice journal. Notice patterns in your own attention. The app shows you what you've been seeing — and what you haven't.",
  },
  {
    name: "Organisational culture",
    desc: "A culture dashboard built from lived experience, not survey scores. See what's really happening through the eyes of the people closest to the work.",
  },
  {
    name: "Impact & change",
    desc: "Evaluation as sense-making. Rather than measuring predefined outcomes, sense for what's actually emerging. Relationships softening. Language changing.",
  },
  {
    name: "Systems sensing",
    desc: "Multiple organisations contributing observations about the same issue. A weak signal in three different places is a strong signal in the system.",
  },
];

const TIERS = [
  {
    name: "Individual",
    plan: "individual",
    price: "£5",
    annual: "£48/year (save 20%)",
    desc: "For your personal reflective practice. Unlimited spaces, 500 observations per month, all views and environments.",
    highlighted: false,
  },
  {
    name: "Organisation",
    plan: "team",
    price: "£25",
    annual: "£240/year · Up to 10 users",
    desc: "For teams sensing together. Shared spaces, collective reflections, 2,000 observations per month, data export, priority support.",
    highlighted: true,
  },
  {
    name: "Large Organisation",
    plan: "organisation",
    price: "£50",
    annual: "£480/year · 25 users + £2/user",
    desc: "For complex systems. Cross-space signal detection, API access, SSO, custom branding, 10,000 observations per month.",
    highlighted: false,
  },
];

function BrandName({ className = "" }: { className?: string }) {
  return (
    <span className={className}>
      under
      <em
        className="bg-gradient-to-r from-cool-1 to-cool-2 bg-clip-text text-transparent"
        style={{ fontStyle: "italic" }}
      >
        current
      </em>
    </span>
  );
}

export default function LandingPage() {
  return (
    <>
      <HeroCanvas />

      <div className="relative z-10">
        {/* ─── NAV ─── */}
        <nav
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-2xl md:px-12"
          style={{
            background: "rgba(10,14,26,0.6)",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <Link
            href="/"
            className="font-display text-xl font-light tracking-wide text-text-primary"
          >
            <BrandName />
          </Link>
          <div className="flex items-center gap-6">
            <a
              href="/sign-in"
              className="text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              Sign in
            </a>
            <a
              href="/sign-in"
              className="rounded-full border border-warm-1/30 bg-warm-1/10 px-5 py-2 text-sm font-medium text-warm-1 transition-all hover:border-warm-1/50 hover:bg-warm-1/20"
            >
              Start sensing
            </a>
          </div>
        </nav>

        {/* ─── HERO ─── */}
        <section className="flex min-h-svh flex-col justify-center px-6 pb-20 pt-32 md:px-12 lg:px-24">
          <div className="max-w-4xl">
            <h1
              className="font-display font-light leading-[0.9] tracking-tight"
              style={{ fontSize: "clamp(3.5rem, 8vw, 8rem)" }}
            >
              <span
                className="block"
                style={{
                  animation:
                    "fade-up 1s cubic-bezier(0.16,1,0.3,1) 0.2s both",
                }}
              >
                under
              </span>
              <span
                className="block bg-gradient-to-r from-cool-1 to-cool-2 bg-clip-text italic text-transparent"
                style={{
                  animation:
                    "fade-up 1s cubic-bezier(0.16,1,0.3,1) 0.4s both",
                }}
              >
                current
              </span>
            </h1>

            <p
              className="mt-8 font-display font-light italic text-text-secondary"
              style={{
                fontSize: "clamp(1.3rem, 2.5vw, 2rem)",
                animation: "fade-up 0.8s cubic-bezier(0.16,1,0.3,1) 0.7s both",
              }}
            >
              Sense what&apos;s shifting
            </p>

            <p
              className="mt-6 max-w-lg text-base leading-relaxed text-text-muted md:text-lg"
              style={{
                animation: "fade-up 0.8s cubic-bezier(0.16,1,0.3,1) 0.9s both",
              }}
            >
              A platform for observations, signals, and reflections. Helping
              people and organisations sense what&apos;s emerging — before it
              becomes obvious.
            </p>

            <div
              className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6"
              style={{
                animation:
                  "fade-up 0.8s cubic-bezier(0.16,1,0.3,1) 1.1s both",
              }}
            >
              <a
                href="/sign-in"
                className="rounded-full bg-warm-1 px-8 py-3.5 text-sm font-medium text-deep transition-all hover:shadow-[0_0_40px_rgba(255,107,74,0.3)]"
              >
                Start sensing — free for 30 days
              </a>
              <a
                href="#how-it-works"
                className="text-sm text-text-muted transition-colors hover:text-text-secondary"
              >
                See how it works
              </a>
            </div>
          </div>
        </section>

        {/* ─── PROBLEM ─── */}
        <section className="px-6 py-32 md:px-12 md:py-48 lg:px-24">
          <Reveal className="max-w-3xl">
            <p
              className="font-display font-light leading-snug text-text-primary"
              style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)" }}
            >
              The most important changes are felt before they are measured.
            </p>
            <div className="mt-8 h-px w-16 bg-warm-3/40" />
            <p className="mt-8 max-w-xl text-base leading-relaxed text-text-secondary md:text-lg">
              People notice things constantly — a shift in energy, a
              conversation that surprised them, a pattern they can&apos;t quite
              name. The problem isn&apos;t that people don&apos;t see
              what&apos;s happening. It&apos;s that those noticings have nowhere
              to go.
            </p>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-text-muted md:text-lg">
              Undercurrent gives them a home.
            </p>
          </Reveal>
        </section>

        {/* ─── HOW IT WORKS ─── */}
        <section
          id="how-it-works"
          className="px-6 py-32 md:px-12 md:py-48 lg:px-24"
        >
          <Reveal>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-text-muted">
              How it works
            </p>
          </Reveal>

          <div className="mt-20 space-y-24 md:space-y-32">
            <Reveal className="flex gap-8 md:gap-12">
              <div className="pt-2 text-sm font-light text-text-muted/50">
                01
              </div>
              <div className="border-l border-warm-1/20 pl-8 md:pl-12">
                <h3 className="font-display text-2xl font-light text-warm-1 md:text-3xl">
                  Observe
                </h3>
                <p className="mt-4 max-w-lg text-base leading-relaxed text-text-secondary">
                  What did you notice? Just that. No categories, no scores, no
                  assessment. Text, photo, voice — whatever captures the moment.
                  The act of recording should be easier than forgetting.
                </p>
              </div>
            </Reveal>

            <Reveal className="flex gap-8 md:gap-12" delay={100}>
              <div className="pt-2 text-sm font-light text-text-muted/50">
                02
              </div>
              <div className="border-l border-warm-3/20 pl-8 md:pl-12">
                <h3 className="font-display text-2xl font-light text-warm-3 md:text-3xl">
                  Sense
                </h3>
                <p className="mt-4 max-w-lg text-base leading-relaxed text-text-secondary">
                  AI surfaces patterns from collective observations — signals
                  that no single person could spot alone. A quiet frustration
                  mentioned by three different people becomes a visible pattern.
                </p>
              </div>
            </Reveal>

            <Reveal className="flex gap-8 md:gap-12" delay={200}>
              <div className="pt-2 text-sm font-light text-text-muted/50">
                03
              </div>
              <div className="border-l border-cool-1/20 pl-8 md:pl-12">
                <h3 className="font-display text-2xl font-light text-cool-1 md:text-3xl">
                  Reflect
                </h3>
                <p className="mt-4 max-w-lg text-base leading-relaxed text-text-secondary">
                  What might this mean? What are we missing? What questions
                  aren&apos;t we asking? Reflections are prompted by signal
                  activity, guiding teams toward deeper sense-making.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ─── VIEWS ─── */}
        <section id="views" className="px-6 py-32 md:px-12 md:py-48 lg:px-24">
          <Reveal>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-text-muted">
              Four ways of seeing
            </p>
            <h2
              className="mt-4 font-display font-light text-text-primary"
              style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)" }}
            >
              The same observations through
              <br className="hidden md:block" /> different lenses
            </h2>
          </Reveal>

          <div
            className="mt-16 grid gap-px md:grid-cols-2"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            {VIEWS.map((view, i) => (
              <Reveal
                key={view.name}
                delay={i * 80}
                className="bg-deep p-8 md:p-12"
              >
                <div
                  className="mb-4 h-0.5 w-8 rounded-full"
                  style={{ background: view.color }}
                />
                <h3
                  className="font-display text-xl font-light md:text-2xl"
                  style={{ color: view.color }}
                >
                  {view.name}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  {view.desc}
                </p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ─── ENVIRONMENTS ─── */}
        <section className="py-32 md:py-48">
          <Reveal className="px-6 md:px-12 lg:px-24">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-text-muted">
              Three environments
            </p>
            <h2
              className="mt-4 font-display font-light text-text-primary"
              style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)" }}
            >
              Choose the metaphor that fits
            </h2>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-text-secondary">
              Each space lives in a visual environment that shapes how signals
              and connections appear. Not decoration — a way of thinking.
            </p>
          </Reveal>

          <div className="mt-16 space-y-px">
            {ENVIRONMENTS.map((env) => (
              <div key={env.name} style={{ background: env.bg }}>
                <Reveal className="px-6 py-16 md:px-12 md:py-24 lg:px-24">
                  <div className="flex flex-col gap-8 md:flex-row md:items-start md:gap-24">
                    <div className="shrink-0 md:w-48">
                      <h3 className="font-display text-2xl font-light text-text-primary md:text-3xl">
                        {env.name}
                      </h3>
                      <div className="mt-3 flex gap-1.5">
                        {env.dots.map((c) => (
                          <div
                            key={c}
                            className="h-2 w-2 rounded-full"
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-base leading-relaxed text-text-secondary">
                        {env.metaphor}
                      </p>
                      <p className="mt-3 text-sm text-text-muted">
                        Best for: {env.bestFor}
                      </p>
                    </div>
                  </div>
                </Reveal>
              </div>
            ))}
          </div>
        </section>

        {/* ─── USE CASES ─── */}
        <section className="px-6 py-32 md:px-12 md:py-48 lg:px-24">
          <Reveal>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-text-muted">
              Built for
            </p>
          </Reveal>

          <div className="mt-12 grid gap-12 md:grid-cols-2 md:gap-x-24 md:gap-y-16">
            {USE_CASES.map((uc, i) => (
              <Reveal key={uc.name} delay={i * 80}>
                <h3 className="font-display text-xl font-light text-text-primary">
                  {uc.name}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  {uc.desc}
                </p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ─── PRICING ─── */}
        <section
          id="pricing"
          className="px-6 py-32 md:px-12 md:py-48 lg:px-24"
        >
          <Reveal>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-text-muted">
              Pricing
            </p>
            <h2
              className="mt-4 font-display font-light text-text-primary"
              style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)" }}
            >
              Start with 30 days free
            </h2>
            <p className="mt-3 text-base text-text-secondary">
              No credit card required. Full access during your trial.
            </p>
          </Reveal>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {TIERS.map((tier, i) => (
              <Reveal
                key={tier.name}
                delay={i * 80}
                className={`rounded-2xl border p-8 ${
                  tier.highlighted
                    ? "relative border-warm-1/20 bg-surface"
                    : "border-white/[0.04] bg-surface"
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-8 rounded-full bg-warm-1/10 px-3 py-0.5 text-xs font-medium text-warm-1">
                    Most popular
                  </div>
                )}
                <p
                  className={`text-xs font-medium uppercase tracking-[0.12em] ${
                    tier.highlighted ? "text-warm-1/70" : "text-text-muted"
                  }`}
                >
                  {tier.name}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-light text-text-primary">
                    {tier.price}
                  </span>
                  <span className="text-sm text-text-muted">/month</span>
                </div>
                <p className="mt-1 text-xs text-text-muted">{tier.annual}</p>
                <p className="mt-6 text-sm leading-relaxed text-text-secondary">
                  {tier.desc}
                </p>
                <a
                  href={`/sign-in?plan=${tier.plan}`}
                  className={`mt-8 block rounded-full py-2.5 text-center text-sm transition-all ${
                    tier.highlighted
                      ? "bg-warm-1 font-medium text-deep hover:shadow-[0_0_30px_rgba(255,107,74,0.25)]"
                      : "border border-white/10 text-text-secondary hover:bg-white/[0.03] hover:text-text-primary"
                  }`}
                >
                  Start free trial
                </a>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ─── CTA BANNER ─── */}
        <section className="relative overflow-hidden px-6 py-24 md:px-12 md:py-32 lg:px-24">
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to right, rgba(255,107,74,0.04), rgba(255,209,102,0.02), transparent)",
            }}
          />
          <Reveal className="relative max-w-2xl">
            <h2
              className="font-display font-light text-text-primary"
              style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)" }}
            >
              The signals are already there.
              <br />
              You just need somewhere to look.
            </h2>
            <a
              href="/sign-in"
              className="mt-8 inline-block rounded-full bg-warm-1 px-8 py-3.5 text-sm font-medium text-deep transition-all hover:shadow-[0_0_40px_rgba(255,107,74,0.3)]"
            >
              Start sensing — free for 30 days
            </a>
          </Reveal>
        </section>

        {/* ─── FOOTER ─── */}
        <footer
          className="px-6 py-16 md:px-12 lg:px-24"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="font-display text-lg font-light text-text-primary">
                <BrandName />
              </div>
              <p className="mt-2 text-sm text-text-muted">
                Sense what&apos;s shifting
              </p>
            </div>
            <div className="flex gap-8 text-sm text-text-muted">
              <a
                href="#how-it-works"
                className="transition-colors hover:text-text-secondary"
              >
                How it works
              </a>
              <a
                href="#views"
                className="transition-colors hover:text-text-secondary"
              >
                Views
              </a>
              <a
                href="#pricing"
                className="transition-colors hover:text-text-secondary"
              >
                Pricing
              </a>
              <a
                href="/sign-in"
                className="transition-colors hover:text-text-secondary"
              >
                Sign in
              </a>
            </div>
          </div>
          <div className="mt-12 flex flex-col gap-2 text-xs text-text-muted/60 md:flex-row md:justify-between">
            <p>The Good Ship · tomcw.xyz</p>
            <p>&copy; 2026 Undercurrent. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </>
  );
}
