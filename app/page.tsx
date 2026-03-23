import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-bold">AI Client Reporting</h1>
      <p className="mt-3">Internal dashboard MVP</p>

      <div className="mt-6">
        <Link
          href="/clients"
          className="inline-block rounded bg-black px-4 py-2 text-white"
        >
          View Clients
        </Link>
      </div>
    </main>
  );
}
