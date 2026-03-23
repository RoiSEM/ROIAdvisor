import { BetaAnalyticsDataClient } from "@google-analytics/data";

const client = new BetaAnalyticsDataClient({
  keyFilename: "app/lib/analytics/ga-service-account.json",
});

export async function getGA4Report(propertyId: string) {
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [
      {
        startDate: "30daysAgo",
        endDate: "today",
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

  console.log("GA4 response:", JSON.stringify(response, null, 2));

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

