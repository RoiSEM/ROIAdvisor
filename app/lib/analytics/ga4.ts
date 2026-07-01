import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { readFileSync } from "node:fs";

export class GoogleAnalyticsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAnalyticsConfigError";
  }
}

type AnalyticsRow = {
  metricValues?: Array<{ value?: string | null }> | null;
  dimensionValues?: Array<{ value?: string | null }> | null;
};

function getGoogleAnalyticsClient() {
  const inlineCredentials = process.env.GA_SERVICE_ACCOUNT_JSON;
  const credentialsPath = process.env.GA_SERVICE_ACCOUNT_KEY_PATH;

  let rawCredentials = inlineCredentials;

  if (!rawCredentials && credentialsPath) {
    try {
      rawCredentials = readFileSync(credentialsPath, "utf8");
    } catch {
      throw new GoogleAnalyticsConfigError(
        `GA_SERVICE_ACCOUNT_KEY_PATH could not be read at ${credentialsPath}.`,
      );
    }
  }

  if (!rawCredentials) {
    throw new GoogleAnalyticsConfigError(
      "Google Analytics credentials are missing. Set GA_SERVICE_ACCOUNT_JSON or GA_SERVICE_ACCOUNT_KEY_PATH.",
    );
  }

  let credentials: { client_email?: string; private_key?: string };

  try {
    credentials = JSON.parse(rawCredentials);
  } catch {
    throw new GoogleAnalyticsConfigError(
      "Google Analytics credentials are not valid JSON. Use the full service account JSON in GA_SERVICE_ACCOUNT_JSON or point GA_SERVICE_ACCOUNT_KEY_PATH to a valid JSON file.",
    );
  }

  if (!credentials.client_email) {
    throw new GoogleAnalyticsConfigError(
      "Google Analytics credentials must be a Google service account JSON with client_email. The current value looks like the wrong credential type.",
    );
  }

  if (!credentials.private_key) {
    throw new GoogleAnalyticsConfigError(
      "Google Analytics credentials must be a Google service account JSON with private_key. The current value looks like the wrong credential type.",
    );
  }

  return new BetaAnalyticsDataClient({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key.replace(/\\n/g, "\n"),
    },
  });
}

function getMetricValue(
  row: AnalyticsRow | undefined,
  index: number,
) {
  return Number(row?.metricValues?.[index]?.value || 0);
}

function getDimensionValue(
  row: AnalyticsRow | undefined,
  index: number,
  fallback = "Unknown",
) {
  return row?.dimensionValues?.[index]?.value || fallback;
}

export async function getGA4Report(
  propertyId: string,
  dateRange?: {
    startDate?: string | null;
    endDate?: string | null;
  },
) {
  const client = getGoogleAnalyticsClient();

  const startDate = dateRange?.startDate || "30daysAgo";
  const endDate = dateRange?.endDate || "today";

  const property = `properties/${propertyId}`;
  const dateRanges = [{ startDate, endDate }];

  const [summaryResponse, channelResponse, landingPageResponse, deviceResponse] =
    await Promise.all([
      client.runReport({
        property,
        dateRanges,
        metrics: [
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "activeUsers" },
          { name: "bounceRate" },
          { name: "engagementRate" },
          { name: "conversions" },
        ],
      }),
      client.runReport({
        property,
        dateRanges,
        dimensions: [
          { name: "sessionDefaultChannelGroup" },
          { name: "sessionSourceMedium" },
        ],
        metrics: [
          { name: "sessions" },
          { name: "activeUsers" },
          { name: "conversions" },
          { name: "engagementRate" },
        ],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 8,
      }),
      client.runReport({
        property,
        dateRanges,
        dimensions: [{ name: "landingPagePlusQueryString" }],
        metrics: [
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "conversions" },
          { name: "bounceRate" },
        ],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 8,
      }),
      client.runReport({
        property,
        dateRanges,
        dimensions: [{ name: "deviceCategory" }],
        metrics: [
          { name: "sessions" },
          { name: "activeUsers" },
          { name: "conversions" },
          { name: "engagementRate" },
        ],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 5,
      }),
    ]);
  const [keyEventResponse] = await client.runReport({
    property,
    dateRanges,
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "keyEvents" }],
    orderBys: [{ metric: { metricName: "keyEvents" }, desc: true }],
    limit: 10,
  }).catch((error) => {
    console.warn("Unable to load GA4 key events:", error);
    return [{ rows: [] }];
  });

  const row = summaryResponse[0].rows?.[0];

  return {
    traffic: getMetricValue(row, 0),
    pageViews: getMetricValue(row, 1),
    activeUsers: getMetricValue(row, 2),
    bounceRate: getMetricValue(row, 3),
    engagementRate: getMetricValue(row, 4),
    conversions: getMetricValue(row, 5),
    channelPerformance: (channelResponse[0].rows || []).map((channelRow) => ({
      channel: getDimensionValue(channelRow, 0),
      sourceMedium: getDimensionValue(channelRow, 1),
      sessions: getMetricValue(channelRow, 0),
      activeUsers: getMetricValue(channelRow, 1),
      conversions: getMetricValue(channelRow, 2),
      engagementRate: getMetricValue(channelRow, 3),
    })),
    landingPagePerformance: (landingPageResponse[0].rows || []).map(
      (landingRow) => ({
        landingPage: getDimensionValue(landingRow, 0, "/"),
        sessions: getMetricValue(landingRow, 0),
        pageViews: getMetricValue(landingRow, 1),
        conversions: getMetricValue(landingRow, 2),
        bounceRate: getMetricValue(landingRow, 3),
      }),
    ),
    devicePerformance: (deviceResponse[0].rows || []).map((deviceRow) => ({
      device: getDimensionValue(deviceRow, 0),
      sessions: getMetricValue(deviceRow, 0),
      activeUsers: getMetricValue(deviceRow, 1),
      conversions: getMetricValue(deviceRow, 2),
      engagementRate: getMetricValue(deviceRow, 3),
    })),
    keyEventPerformance: (keyEventResponse.rows || []).map((eventRow) => ({
      eventName: getDimensionValue(eventRow, 0),
      keyEvents: getMetricValue(eventRow, 0),
    })),
  };
}
