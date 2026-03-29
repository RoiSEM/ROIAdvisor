import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { readFileSync } from "node:fs";

export class GoogleAnalyticsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAnalyticsConfigError";
  }
}

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

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [
      {
        startDate,
        endDate,
      },
    ],
    metrics: [
      { name: "sessions" },
      { name: "screenPageViews" },
      { name: "activeUsers" },
      { name: "bounceRate" },
      { name: "engagementRate" },
      { name: "conversions" },
    ],
  });

  console.log(
    "GA4 response:",
    JSON.stringify({ startDate, endDate, response }, null, 2),
  );

  const row = response.rows?.[0];

  return {
    traffic: Number(row?.metricValues?.[0]?.value || 0),
    pageViews: Number(row?.metricValues?.[1]?.value || 0),
    activeUsers: Number(row?.metricValues?.[2]?.value || 0),
    bounceRate: Number(row?.metricValues?.[3]?.value || 0),
    engagementRate: Number(row?.metricValues?.[4]?.value || 0),
    conversions: Number(row?.metricValues?.[5]?.value || 0),
  };
}
