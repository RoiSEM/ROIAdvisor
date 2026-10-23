import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getMilestoneGuide,
  MILESTONE_GUIDES,
  milestoneHelpHref,
} from "@/lib/milestone-guides";

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() {
  return Object.keys(MILESTONE_GUIDES).map((slug) => ({ slug }));
}
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const g = getMilestoneGuide(slug);
  return { title: g ? `${g.title} | Convert` : "Guide not found" };
}
export default async function MilestoneGuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = getMilestoneGuide(slug);
  if (!guide) notFound();
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6 sm:p-10">
      <Link href="/dashboard" className="text-sm underline">
        Back to dashboard
      </Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
          Convert · Do it yourself
        </p>
        <h1 className="mt-2 text-3xl font-bold">{guide.title}</h1>
        <p className="mt-3 text-sm">
          Follow the guide independently, or ask George for help with this same
          task. Reading the guide does not itself earn milestone points.
        </p>
      </header>
      <section className="rounded-xl border p-5">
        <h2 className="text-lg font-semibold">Before you start</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          {guide.prerequisites.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Follow these steps</h2>
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-7">
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950">
        <h2 className="font-semibold">Check the outcome</h2>
        <p className="mt-2 text-sm leading-7">{guide.successCheck}</p>
      </section>
      <section>
        <h2 className="font-semibold">What this does not establish</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          {guide.limits.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <aside className="rounded-xl border p-5">
        <h2 className="font-semibold">Prefer help with this task?</h2>
        <p className="mt-2 text-sm">
          Ask George about {guide.title.toLowerCase()}. Any scope and fees are
          agreed separately; help is optional.
        </p>
        <a
          className="mt-3 inline-block rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
          href={milestoneHelpHref(guide.title)}
        >
          Get help from George
        </a>
      </aside>
    </main>
  );
}
