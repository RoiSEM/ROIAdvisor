export type UploadedAnalytics = {
  traffic: number | null;
  pageViews: number | null;
  activeUsers: number | null;
  bounceRate: number | null;
  engagementRate: number | null;
  conversions: number | null;
  channelPerformance: Array<Record<string, string | number>>;
  landingPagePerformance: Array<Record<string, string | number>>;
  devicePerformance: Array<Record<string, string | number>>;
  keyEventPerformance: Array<Record<string, string | number>>;
};

export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 10000;
type Metric = "traffic" | "conversions" | "pageViews" | "activeUsers" | "bounceRate" | "engagementRate";
type Dimension = "channel" | "landingPage" | "device";
const aliases: Record<string, Metric | Dimension> = {
  sessions: "traffic", sessioncount: "traffic",
  conversions: "conversions", keyevents: "conversions",
  views: "pageViews", pageviews: "pageViews", screenpageviews: "pageViews",
  activeusers: "activeUsers", bouncerate: "bounceRate", engagementrate: "engagementRate",
  channel: "channel", channelname: "channel", defaultchannelgroup: "channel",
  sessiondefaultchannelgroup: "channel", sessionsourcemedium: "channel",
  landingpage: "landingPage", landingpageplusquerystring: "landingPage",
  device: "device", devicecategory: "device",
};
const metrics: Metric[] = ["traffic", "conversions", "pageViews", "activeUsers", "bounceRate", "engagementRate"];

/** Read records, not physical lines: quoted dimensions can contain newlines. */
function readRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [], cell = "", quoted = false, closed = false;
  const endCell = () => { row.push(cell.trim()); cell = ""; closed = false; };
  const endRow = () => {
    endCell();
    if (row.some(value => value !== "")) records.push(row);
    if (records.length > MAX_CSV_ROWS + 1) throw new Error("CSV row limit exceeded: maximum 10,000 data rows.");
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; closed = true; }
      } else cell += char;
    } else if (char === ",") endCell();
    else if (char === "\n" || char === "\r") {
      endRow();
      if (char === "\r" && text[i + 1] === "\n") i++;
    } else if (char === '"') {
      if (closed || cell.trim()) throw new Error("Malformed CSV quotes: quote inside an unquoted field.");
      cell = ""; quoted = true;
    } else if (closed) {
      if (!/\s/.test(char)) throw new Error("Malformed CSV quotes: text after a closing quote.");
    } else cell += char;
  }
  if (quoted) throw new Error("Malformed CSV quotes: unclosed quoted field.");
  if (cell || row.length || closed) endRow();
  return records;
}

function measurement(value: string, field: Metric): number | null {
  if (!value) return null;
  const rate = field === "bounceRate" || field === "engagementRate";
  const pattern = rate ? /^(?:\d+(?:\.\d+)?|\.\d+)%?$/ : /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;
  if (!pattern.test(value)) throw new Error(`Invalid nonnegative numeric value for ${field}. Counts cannot contain currency or percentage symbols; rates use 0–1 or a percent sign.`);
  let number = Number(value.replace(/,/g, "").replace(/%$/, ""));
  if (rate && value.endsWith("%")) number /= 100;
  if (!Number.isFinite(number) || number > Number.MAX_SAFE_INTEGER || (rate && number > 1)) {
    throw new Error(`Invalid ${field}: counts must be finite; rates must use 0–1 or 0–100%.`);
  }
  return number;
}

type ParsedRow = { label: string; values: Record<Metric, number | null> };
function sum(rows: ParsedRow[], field: Metric): number | null {
  if (rows.some(row => row.values[field] === null)) return null;
  const value = rows.reduce((total, row) => total + row.values[field]!, 0);
  if (!Number.isFinite(value) || value > Number.MAX_SAFE_INTEGER) throw new Error("CSV aggregate count exceeds the supported numeric limit.");
  return value;
}
function weightedRate(rows: ParsedRow[], field: "bounceRate" | "engagementRate"): number | null {
  if (rows.length === 1) return rows[0].values[field];
  if (rows.some(row => row.values.traffic! > 0 && row.values[field] === null)) return null;
  const sessions = sum(rows, "traffic")!;
  return sessions > 0 ? rows.reduce((total, row) => total + (row.values[field] ?? 0) * row.values.traffic!, 0) / sessions : null;
}

/** Only a summary or one complete, session-partitioned table is supported. */
export function parseAnalyticsCsv(text: string): UploadedAnalytics {
  if (typeof text !== "string" || !text.trim()) throw new Error("Missing CSV. Required columns: Sessions and Conversions (or Key Events).");
  if (text.length > MAX_CSV_BYTES || new TextEncoder().encode(text).length > MAX_CSV_BYTES) throw new Error("CSV size limit exceeded: maximum 5MB.");
  let content = text.replace(/^\uFEFF/, "");
  // Comments are allowed only as a preamble, never silently removed from data.
  while (/^\s*(?:#|\r?\n)/.test(content)) {
    const newline = content.indexOf("\n");
    content = newline < 0 ? "" : content.slice(newline + 1);
    if (!content) break;
  }
  const records = readRecords(content);
  if (records.length < 2) throw new Error("CSV needs a header and a data row. Required columns: Sessions and Conversions (or Key Events).");
  const headers = records[0];
  const columns = new Map<Metric | Dimension, number>();
  const normalized = new Set<string>();
  for (let index = 0; index < headers.length; index++) {
    const name = headers[index].toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!name || normalized.has(name)) throw new Error("Duplicate or blank ambiguous CSV header.");
    normalized.add(name);
    const field = Object.hasOwn(aliases, name) ? aliases[name] : undefined;
    if (!field) throw new Error(`Unsupported column '${headers[index]}'. Required columns: Sessions and Conversions (or Key Events). Optional columns: Views, Active Users, Bounce Rate, Engagement Rate, and at most one Channel, Landing Page, or Device column. Users are not Sessions.`);
    if (columns.has(field)) throw new Error(`Ambiguous CSV: more than one column maps to ${field}. Export a single measurement for each field.`);
    columns.set(field, index);
  }
  if (!columns.has("traffic") || !columns.has("conversions")) throw new Error("Missing required columns: Sessions and Conversions (or Key Events).");
  const dimensions = (["channel", "landingPage", "device"] as Dimension[]).filter(key => columns.has(key));
  if (dimensions.length > 1) throw new Error("Mixed dimensions are unsupported. Export one Channel, Landing Page, or Device table.");
  const dimension = dimensions[0];
  const parsed: ParsedRow[] = records.slice(1).map((cells, index) => {
    if (cells.length !== headers.length) throw new Error(`Ragged CSV row ${index + 2}: column count does not match the header.`);
    const values = Object.fromEntries(metrics.map(field => [field, columns.has(field) ? measurement(cells[columns.get(field)!], field) : null])) as Record<Metric, number | null>;
    if (values.traffic === null || values.conversions === null) throw new Error(`Required Sessions or Conversions is missing in CSV row ${index + 2}. Missing is not zero.`);
    const label = dimension ? cells[columns.get(dimension)!] : "";
    if (dimension && !label) throw new Error(`Missing ${dimension} value in CSV row ${index + 2}.`);
    return {label, values};
  });
  if (!dimension && parsed.length !== 1) throw new Error("Multiple summary rows are ambiguous. Export one summary row or one complete session-partitioned table.");
  const totals = dimension ? parsed.filter(row => /^(?:total|grand total|sum)$/i.test(row.label)) : [];
  if (totals.length > 1) throw new Error("Multiple CSV total rows are ambiguous.");
  const details = parsed.filter(row => !totals.includes(row));
  if (dimension && new Set(details.map(row => row.label.toLowerCase())).size !== details.length) throw new Error("Duplicate dimension rows are ambiguous and could double-count sessions.");
  const total = totals[0];
  if (total && details.length) {
    for (const field of ["traffic", "conversions", "pageViews"] as Metric[]) {
      const detailSum = sum(details, field), reported = total.values[field];
      if (detailSum !== null && reported !== null && Math.abs(detailSum - reported) > 1e-8 * Math.max(1, reported)) {
        throw new Error(`CSV total conflicts with its detail rows for ${field}. Use a complete export, not a truncated table or mixed totals.`);
      }
    }
    for (const field of ["bounceRate", "engagementRate"] as const) {
      const combined = weightedRate(details, field), reported = total.values[field];
      // Allow 0.1 percentage point for rounding in exported rates.
      if (combined !== null && reported !== null && Math.abs(combined - reported) > 0.001) {
        throw new Error(`CSV total conflicts with its detail rows for ${field}. Export a consistent complete table.`);
      }
    }
  }
  const rows = total ? [total] : details;
  const result: UploadedAnalytics = {
    traffic: sum(rows, "traffic"), conversions: sum(rows, "conversions"),
    pageViews: sum(rows, "pageViews"),
    activeUsers: rows.length === 1 ? rows[0].values.activeUsers : null,
    bounceRate: weightedRate(rows, "bounceRate"), engagementRate: weightedRate(rows, "engagementRate"),
    channelPerformance: [], landingPagePerformance: [], devicePerformance: [], keyEventPerformance: [],
  };
  if (dimension) {
    const key = {channel: "channelPerformance", landingPage: "landingPagePerformance", device: "devicePerformance"} as const;
    result[key[dimension]] = details.slice(0, 8).map(row => {
      const item: Record<string, string | number> = {[dimension]: row.label, sessions: row.values.traffic!, conversions: row.values.conversions!};
      for (const field of ["pageViews", "bounceRate", "engagementRate"] as Metric[]) if (row.values[field] !== null) item[field] = row.values[field]!;
      return item;
    });
  }
  return result;
}
