export type ConnectionProof = {
  source: "ga4" | "upload";
  propertyId: string | null;
  verifiedAt: string;
};
const START = "[convert-connection-v1]";
const END = "[/convert-connection-v1]";

/** Provenance is written only by successful server acquisition paths, never a form. */
export function readConnectionProof(
  notes: string | null | undefined,
): ConnectionProof | null {
  if (typeof notes !== "string") return null;
  const line = notes.split(/\r?\n/, 1)[0];
  if (line.length > 512 || !line.startsWith(START) || !line.endsWith(END))
    return null;
  try {
    const value: unknown = JSON.parse(line.slice(START.length, -END.length));
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const p = value as Record<string, unknown>;
    if (p.source !== "ga4" && p.source !== "upload") return null;
    if (
      typeof p.verifiedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(p.verifiedAt)
    )
      return null;
    const time = Date.parse(p.verifiedAt);
    if (
      !Number.isFinite(time) ||
      time > Date.now() ||
      new Date(time).toISOString() !== p.verifiedAt
    )
      return null;
    if (
      p.source === "ga4" &&
      (typeof p.propertyId !== "string" || !/^\d{1,20}$/.test(p.propertyId))
    )
      return null;
    if (p.source === "upload" && p.propertyId !== null) return null;
    return {
      source: p.source,
      propertyId: p.source === "ga4" ? (p.propertyId as string) : null,
      verifiedAt: p.verifiedAt,
    };
  } catch {
    return null;
  }
}

/** Strip all reserved marker lines before accepting user-controlled notes. */
export function removeConnectionProof(
  notes: string | null | undefined,
): string {
  return typeof notes === "string"
    ? notes
        .split(/\r?\n/)
        .filter((line) => !line.includes(START) && !line.includes(END))
        .join("\n")
        .trim()
    : "";
}
export function writeConnectionProof(
  notes: string | null | undefined,
  proof: ConnectionProof,
): string {
  const line = `${START}${JSON.stringify(proof)}${END}`;
  if (!readConnectionProof(line))
    throw new Error("Invalid connection evidence");
  return [line, removeConnectionProof(notes)].filter(Boolean).join("\n");
}
export function preserveConnectionProof(
  existing: string | null | undefined,
  incoming: string | null | undefined,
  nextPropertyId: unknown,
): string {
  const clean = removeConnectionProof(incoming);
  const proof = readConnectionProof(existing);
  return proof?.source === "ga4" && proof.propertyId === nextPropertyId
    ? writeConnectionProof(clean, proof)
    : clean;
}
