import Link from "next/link";

type LegalSection = {
  title: string;
  paragraphs: readonly string[];
};

type LegalPageShellProps = {
  eyebrow: string;
  title: string;
  intro: string;
  lastUpdated: string;
  sections: readonly LegalSection[];
};

export default function LegalPageShell({
  eyebrow,
  title,
  intro,
  lastUpdated,
  sections,
}: LegalPageShellProps) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8 sm:py-20">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm sm:p-10 dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 pb-8 dark:border-slate-800">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              {eyebrow}
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">
              Last updated {lastUpdated}
            </p>
            <p className="mt-6 max-w-3xl text-base leading-8 text-slate-600 dark:text-slate-300">
              {intro}
            </p>
          </div>

          <div className="mt-10 space-y-10">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                  {section.title}
                </h2>
                <div className="mt-4 space-y-4">
                  {section.paragraphs.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="text-sm leading-7 text-slate-600 sm:text-base dark:text-slate-300"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <footer className="mt-8 flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:text-slate-400">
          <p>Convert by WhachaWant</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/" className="inline-flex min-h-11 min-w-11 items-center justify-center transition hover:text-slate-900 dark:hover:text-white">
              Home
            </Link>
            <Link
              href="/privacy-policy"
              className="inline-flex min-h-11 min-w-11 items-center justify-center transition hover:text-slate-900 dark:hover:text-white"
            >
              Privacy Policy
            </Link>
            <Link href="/terms" className="inline-flex min-h-11 min-w-11 items-center justify-center transition hover:text-slate-900 dark:hover:text-white">
              Terms
            </Link>
            <a
              href="mailto:george@roisem.com"
              className="inline-flex min-h-11 min-w-11 items-center justify-center transition hover:text-slate-900 dark:hover:text-white"
            >
              george@roisem.com
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
