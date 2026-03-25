import Link from "next/link";

// update for ready only

type LegalSection = {
  title: string;
  paragraphs: string[];
};

type LegalPageShellProps = {
  eyebrow: string;
  title: string;
  intro: string;
  lastUpdated: string;
  sections: LegalSection[];
};

export default function LegalPageShell({
  eyebrow,
  title,
  intro,
  lastUpdated,
  sections,
}: LegalPageShellProps) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8 sm:py-20">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <div className="border-b border-slate-200 pb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
              {eyebrow}
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 text-sm font-medium text-slate-500">
              Last updated {lastUpdated}
            </p>
            <p className="mt-6 max-w-3xl text-base leading-8 text-slate-600">
              {intro}
            </p>
          </div>

          <div className="mt-10 space-y-10">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                  {section.title}
                </h2>
                <div className="mt-4 space-y-4">
                  {section.paragraphs.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="text-sm leading-7 text-slate-600 sm:text-base"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <footer className="mt-8 flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Convert by WhachaWant</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/" className="transition hover:text-slate-900">
              Home
            </Link>
            <Link
              href="/privacy-policy"
              className="transition hover:text-slate-900"
            >
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition hover:text-slate-900">
              Terms
            </Link>
            <a
              href="mailto:george@roisem.com"
              className="transition hover:text-slate-900"
            >
              george@roisem.com
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
