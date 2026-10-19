type AnalyticsMetrics = Record<string, unknown> & {
  traffic: number;
  conversions: number;
};

/** Validate supplied measurements without turning absent values into zero. */
export function hasValidReportMetrics(value: unknown): value is AnalyticsMetrics {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const metrics = value as Record<string, unknown>;
  for (const key of ["traffic", "conversions", "pageViews", "activeUsers"]) {
    const metric = metrics[key];
    const required = key === "traffic" || key === "conversions";
    if (!required && metric == null) continue;
    if (typeof metric !== "number" || !Number.isFinite(metric) || metric < 0) return false;
  }
  for (const key of ["bounceRate", "engagementRate"]) {
    const metric = metrics[key];
    if (metric == null) continue;
    if (typeof metric !== "number" || !Number.isFinite(metric) || metric < 0 || metric > 1) return false;
  }
  return true;
}
