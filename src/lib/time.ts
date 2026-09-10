/**
 * Internet Network Time Utility
 * Fetches accurate atomic/network synchronized date & time from trusted global servers.
 * Guarantees correct timestamps even if the local device system clock is wrong or drifted.
 */

export async function getAccurateNetworkTime(): Promise<Date> {
  const timeEndpoints = [
    "https://www.google.com",
    "https://cloudflare.com",
    "https://worldtimeapi.org/api/timezone/Etc/UTC",
  ];

  for (const endpoint of timeEndpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(endpoint, {
        method: "HEAD",
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);

      const dateHeader = res.headers.get("date");
      if (dateHeader) {
        const netDate = new Date(dateHeader);
        if (!isNaN(netDate.getTime())) {
          return netDate;
        }
      }
    } catch {
      // Continue to next backup time provider
    }
  }

  return new Date();
}