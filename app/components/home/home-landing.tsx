import Link from "next/link";
import ManageBillingButton from "@/components/manage-billing-button";
import ThemeSwitch from "@/components/theme-switch";
import HomeScrollMotion from "./home-scroll-motion";
import { milestoneHelpHref } from "@/lib/milestone-guides";
import styles from "./home-landing.module.css";

export type HomeLandingProps = {
  isSignedIn: boolean;
  canManageBilling: boolean;
  year: number;
};

const cx = (...names: (string | false | undefined)[]) =>
  names.filter(Boolean).join(" ");

const NEXT_STEPS = [
  {
    id: "step-connect",
    priority: true,
    title: "Connect Google Analytics",
    body: "Without a verified connection, Convert can only work from what you tell it. Connecting lets reports rely on recorded activity.",
    why: "every later step is easier to check once real data is available.",
    outline: [
      "Sign in to Convert and add your website with its GA4 property ID.",
      "In Google Analytics, open property access management and add the read-only access Convert asks for.",
      "Return to Convert and run the connection check.",
    ],
    guide: "connect-analytics",
    helpTopic: "Connect Google Analytics",
    helpLabel: "Ask George about connecting Analytics",
  },
  {
    id: "step-action",
    priority: false,
    title: "Choose the action you want visitors to take",
    body: "A call, a form, a booking or a purchase. Reports can only judge progress against a goal you\u2019ve named.",
    outline: [
      "Pick the one action that most often leads to a customer.",
      "Write it down in your website settings in Convert.",
      "If you know it, add what a typical customer is worth. An estimate is fine; Convert treats it as one.",
    ],
    guide: "define-action",
    helpTopic: "Choose the intended action",
    helpLabel: "Ask George about choosing an action",
  },
  {
    id: "step-test",
    priority: false,
    title: "Test your contact form end to end",
    body: "Make sure a submission arrives where you expect and is recorded as an event.",
    outline: [
      "Submit a clearly labeled test inquiry from your own site.",
      "Confirm the message arrives in your inbox or CRM.",
      "Check that Analytics recorded the event, then note the date of the test in Convert.",
    ],
    guide: "test-tracking",
    helpTopic: "Test the contact journey",
    helpLabel: "Ask George about testing the form",
  },
] as const;

function Arrow() {
  return (
    <span className={styles.arrow} aria-hidden="true">
      →
    </span>
  );
}

export default function HomeLanding({
  isSignedIn,
  canManageBilling,
  year,
}: HomeLandingProps) {
  const primaryHref = isSignedIn ? "/dashboard" : "/login";
  const primaryLabel = isSignedIn ? "Open dashboard" : "Start with your website";

  return (
    <div className={styles.home}>
      <HomeScrollMotion />
      <a className={styles.skip} href="#main">
        Skip to content
      </a>

      <header className={styles.siteHeader}>
        <div className={cx(styles.wrap, styles.nav)}>
          <Link
            className={styles.brand}
            href="/"
            aria-label="Convert by WhachaWant, home"
          >
            <span className={styles.brandMark} aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 17l5-5 4 3 7-8" />
                <path d="M15 7h5v5" />
              </svg>
            </span>
            <span className={styles.brandText}>
              <span className={styles.brandName}>Convert</span>
              <span className={styles.brandBy}>BY WHACHAWANT</span>
            </span>
          </Link>
          <nav aria-label="Primary" className={styles.navLinksWrap}>
            <ul className={styles.navLinks}>
              <li>
                <a href="#what-you-learn">What you learn</a>
              </li>
              <li>
                <a href="#how">How it works</a>
              </li>
              <li>
                <a href="#next-steps">Next steps</a>
              </li>
              <li>
                <Link href="/pricing">Pricing</Link>
              </li>
            </ul>
          </nav>
          <ThemeSwitch />
          {isSignedIn ? (
            <Link className={cx(styles.btn, styles.btnGhost, styles.btnSm)} href="/dashboard">
              Dashboard
            </Link>
          ) : (
            <Link className={cx(styles.btn, styles.btnGhost, styles.btnSm)} href="/login">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main id="main" tabIndex={-1} className={styles.main}>
        {/* HERO */}
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={cx(styles.wrap, styles.heroGrid)}>
            <div>
              <span className={styles.eyebrow}>
                Conversion advisor for small-business websites
              </span>
              <h1 id="hero-title" className={styles.heroTitle}>
                Learn what your website data <em>actually shows</em>, then
                decide what to do next.
              </h1>
              <p className={styles.lede}>
                Convert reads the Analytics data you connect, explains in plain
                language what it does and doesn&rsquo;t establish yet, and
                suggests a few practical next steps. Do each one yourself with a
                written walkthrough, or ask George for help with that one task.
              </p>
              <div className={styles.heroCtas}>
                <Link className={cx(styles.btn, styles.btnPrimary)} href={primaryHref}>
                  {primaryLabel} <Arrow />
                </Link>
                <a className={cx(styles.btn, styles.btnGhost)} href="#how">
                  See how it works
                </a>
              </div>
              <ul className={styles.heroFacts} aria-label="What to expect">
                <li>Doesn&rsquo;t change your website</li>
                <li>No results guaranteed</li>
                <li>Help is optional</li>
              </ul>
            </div>

            <figure className={styles.illus} aria-labelledby="illus-cap">
              <div className={styles.illusHead}>
                <div>
                  <div className={styles.illusTitle}>Your path to a useful grade</div>
                  <div className={styles.illusSub}>
                    Example website · no data connected yet
                  </div>
                </div>
                <span className={cx(styles.tag, styles.tagDemo)}>Illustration</span>
              </div>
              <div className={styles.track} aria-hidden="true">
                <div className={cx(styles.stop, styles.stopNow)}>
                  <div className={styles.dot}>1</div>
                  <span className={styles.lbl}>Connect</span>
                  <span className={styles.note}>Biggest step</span>
                </div>
                <div className={styles.stop}>
                  <div className={styles.dot}>2</div>
                  <span className={styles.lbl}>Get ready</span>
                  <span className={styles.note}>Up to 70</span>
                </div>
                <div className={styles.stop}>
                  <div className={styles.dot}>3</div>
                  <span className={styles.lbl}>Results</span>
                  <span className={styles.note}>Smaller gains</span>
                </div>
                <div className={styles.stop}>
                  <div className={cx(styles.dot, styles.dotDashed)}>∞</div>
                  <span className={styles.lbl}>Keep learning</span>
                  <span className={styles.note}>Never 100</span>
                </div>
              </div>
              <div className={styles.meter} aria-hidden="true">
                <div className={styles.meterCap}>
                  Grading scale · not this site&rsquo;s progress
                </div>
                <div className={styles.meterBar}>
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className={styles.meterLegend}>
                  <span>
                    <b>0</b> until connected
                  </span>
                  <span>
                    Readiness to <b>70</b>
                  </span>
                  <span>
                    Never <b>100</b>
                  </span>
                </div>
              </div>
              <div className={styles.miniSteps} aria-hidden="true">
                {[
                  ["Connect Google Analytics", "Priority · turns guesses into evidence"],
                  ["Choose the action you want", "Call, form, booking or purchase"],
                  ["Test your contact form", "Submit, receive, record"],
                ].map(([t, s], i) => (
                  <div key={t} className={cx(styles.mini, i === 0 && styles.miniFirst)}>
                    <span className={styles.n}>{i + 1}</span>
                    <span className={styles.t}>
                      {t}
                      <span className={styles.s}>{s}</span>
                    </span>
                    <span className={styles.chips}>
                      <span className={styles.chip}>DIY guide</span>
                      <span className={styles.chip}>Ask George</span>
                    </span>
                  </div>
                ))}
              </div>
              <figcaption id="illus-cap" className={styles.illusFoot}>
                Illustration only: not a screenshot or real customer data. It
                shows how the grade is designed to work: zero before a verified
                connection, readiness up to 70, and never 100. Exact point
                weights are still being refined.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* WHAT YOU LEARN */}
        <section className={styles.band} id="what-you-learn" aria-labelledby="learn-title">
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow}>What you learn</span>
              <h2 id="learn-title">
                Not more charts. A straight answer about what your data can
                support.
              </h2>
              <p>
                Most small-business owners have Analytics installed but no clear
                reading of it. Convert is built to teach as it reports, so you
                understand the evidence instead of just collecting numbers.
              </p>
            </div>
            <div className={styles.valueGrid}>
              <article className={styles.valueMain} data-motion-card="">
                <h3>Three questions every report tries to answer</h3>
                <p>
                  Written for owners, not analysts. Where the data is thin, the
                  report says so rather than guessing.
                </p>
                <ul className={styles.qa}>
                  <li>
                    <span className={cx(styles.k, styles.kOk)}>Established</span>
                    <span>
                      What your connected data does show: where visits come from
                      and which actions you&rsquo;ve told Convert to count.
                    </span>
                  </li>
                  <li>
                    <span className={cx(styles.k, styles.kGap)}>Not yet known</span>
                    <span>
                      What the data can&rsquo;t support yet, such as too little
                      activity, events that aren&rsquo;t named, or a goal that
                      hasn&rsquo;t been set.
                    </span>
                  </li>
                  <li>
                    <span className={cx(styles.k, styles.kNext)}>Next decision</span>
                    <span>
                      The most useful thing to do next, and why it comes before
                      the rest.
                    </span>
                  </li>
                </ul>
              </article>
              <div className={styles.valueSide}>
                <div className={styles.sideCard} data-motion-card="">
                  <h3>Your choice of route</h3>
                  <p>
                    Every suggested step comes with a short written walkthrough.
                    If you&rsquo;d rather not do it yourself, you can email
                    George about that specific task.
                  </p>
                </div>
                <div className={styles.sideCard} data-motion-card="">
                  <h3>Progress you can see</h3>
                  <p>
                    A grade tracks how ready your site is to measure real
                    inquiries, and later what the results show. It&rsquo;s there
                    to support learning, not to rank you.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW */}
        <section className={styles.band} id="how" aria-labelledby="how-title">
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow}>How it works</span>
              <h2 id="how-title">One path, from no data to useful evidence.</h2>
              <p>
                The grade rewards setup work you can control before traffic
                arrives, then smaller gains from what your recorded activity
                actually shows.
              </p>
            </div>
            <ol className={styles.path}>
              <li data-motion-card="">
                <h3>Start</h3>
                <p>
                  Before Convert can read verified data, your site is shown as
                  not started, not as failing. Every site begins here.
                </p>
                <span className={cx(styles.tag, styles.status, styles.statusNeutral)}>
                  Not started
                </span>
              </li>
              <li className={styles.pathBig} data-motion-card="">
                <h3>Connect your data</h3>
                <p>
                  Grant Convert read access to your Google Analytics property,
                  or upload a supported report. This is the biggest single step.
                </p>
                <span className={cx(styles.tag, styles.status, styles.statusGreen)}>
                  Biggest step
                </span>
              </li>
              <li data-motion-card="">
                <h3>Get ready to measure</h3>
                <p>
                  Name the action you want, set a monthly goal, label your
                  events and test the journey. Readiness can reach 70 even
                  before much traffic arrives.
                </p>
                <span className={cx(styles.tag, styles.status, styles.statusAmber)}>
                  Up to 70
                </span>
              </li>
              <li data-motion-card="">
                <h3>Learn from results</h3>
                <p>
                  Once real activity is recorded, smaller gains come from
                  progress against your own goal. No site is perfect, so the
                  grade never reaches 100.
                </p>
                <span className={cx(styles.tag, styles.status, styles.statusBlue)}>
                  Never 100
                </span>
              </li>
            </ol>
            <p className={styles.disclose}>
              Exact point weights are still being refined, so none are listed
              here. Uploaded reports are labeled as user-supplied data.
            </p>
          </div>
        </section>

        {/* NEXT STEPS */}
        <section className={styles.band} id="next-steps" aria-labelledby="steps-title">
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow}>Next steps</span>
              <h2 id="steps-title">
                A few clear next steps, each with two ways to get it done.
              </h2>
              <p>
                One priority, plus alternatives you can swap in. These are
                examples of the kind of step Convert suggests.{" "}
                <span className={cx(styles.tag, styles.tagDemo)}>Examples</span>
              </p>
            </div>
            <div className={styles.steps}>
              {NEXT_STEPS.map((step) => (
                <article
                  key={step.id}
                  className={cx(styles.step, step.priority && styles.stepPriority)}
                  aria-labelledby={step.id}
                  data-motion-card=""
                >
                  <div className={styles.stepTop}>
                    {step.priority ? (
                      <span className={cx(styles.tag, styles.status, styles.statusGreen)}>
                        Priority
                      </span>
                    ) : (
                      <span className={styles.tag}>Alternative</span>
                    )}
                  </div>
                  <h3 id={step.id}>{step.title}</h3>
                  <p>{step.body}</p>
                  {"why" in step && (
                    <div className={styles.why}>
                      <b>Why first:</b> {step.why}
                    </div>
                  )}
                  <details className={styles.diy}>
                    <summary>
                      Do it yourself: outline{" "}
                      <span className={styles.chev} aria-hidden="true">
                        ▾
                      </span>
                    </summary>
                    <ol>
                      {step.outline.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ol>
                    <Link className={styles.guideLink} href={`/guides/${step.guide}`}>
                      Read the full guide <Arrow />
                    </Link>
                  </details>
                  <a className={styles.helpLink} href={milestoneHelpHref(step.helpTopic)}>
                    {step.helpLabel}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* BOUNDARIES */}
        <section className={styles.band} id="boundaries" aria-labelledby="bound-title">
          <div className={cx(styles.wrap, styles.notGrid)}>
            <div className={cx(styles.sectionHead, styles.sectionHeadTight)}>
              <span className={styles.eyebrow}>Plain boundaries</span>
              <h2 id="bound-title">What Convert doesn&rsquo;t do.</h2>
              <p>Setting expectations clearly is part of the advice.</p>
            </div>
            <ul className={styles.notList}>
              <li data-motion-card="">
                <b>It doesn&rsquo;t edit your site</b>
                <span>
                  Convert reads data. It doesn&rsquo;t install scripts or change
                  pages for you.
                </span>
              </li>
              <li data-motion-card="">
                <b>It doesn&rsquo;t promise results</b>
                <span>
                  It explains what your own data shows. Outcomes depend on what
                  you change.
                </span>
              </li>
              <li data-motion-card="">
                <b>It doesn&rsquo;t watch your site live</b>
                <span>
                  Reports cover the period you choose, from the data available.
                </span>
              </li>
              <li data-motion-card="">
                <b>Help is never assumed</b>
                <span>
                  Emailing George is optional and about one task at a time. No
                  package is implied.
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* PRICING (link out; no prices on the homepage) */}
        <section className={styles.band} id="pricing" aria-labelledby="pricing-title">
          <div className={styles.wrap}>
            <div className={styles.pricing} data-motion-card="">
              <div>
                <span className={styles.eyebrow}>Pricing</span>
                <h2 id="pricing-title">Plans and current prices</h2>
                <p>
                  Plan details, limits and current prices live on the pricing
                  page, so this page can stay focused on what Convert does.
                </p>
              </div>
              <Link className={cx(styles.btn, styles.btnGhost)} href="/pricing">
                View pricing <Arrow />
              </Link>
            </div>
          </div>
        </section>

        {/* CLOSING */}
        <section
          className={cx(styles.band, styles.bandClosing)}
          id="start"
          aria-labelledby="start-title"
        >
          <div className={styles.wrap}>
            <div className={styles.closing} data-motion-card="">
              <div>
                <span className={styles.eyebrow}>Start here</span>
                <h2 id="start-title">Start with the connection.</h2>
                <p>
                  Connecting your Analytics data is what turns guesses into
                  evidence. The approval steps can be fiddly. If you get stuck,
                  ask.
                </p>
              </div>
              <div className={styles.closingCtas}>
                <Link className={cx(styles.btn, styles.btnPrimary)} href={primaryHref}>
                  {primaryLabel} <Arrow />
                </Link>
                {isSignedIn && canManageBilling && (
                  <ManageBillingButton className={cx(styles.btn, styles.btnGhost)} />
                )}
                <a
                  className={cx(styles.btn, styles.btnGhost)}
                  href={`mailto:george@roisem.com?subject=${encodeURIComponent("Convert question")}`}
                >
                  Ask George a question
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.siteFooter}>
        <div className={cx(styles.wrap, styles.foot)}>
          <div>
            <strong>Convert</strong> by WhachaWant · © {year}
          </div>
          <nav aria-label="Footer">
            <Link href="/privacy-policy">Privacy Policy</Link>
            <Link href="/terms">Terms &amp; Conditions</Link>
            <a href="mailto:george@roisem.com">george@roisem.com</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
