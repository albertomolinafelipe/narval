import Script from "next/script";

export default function UmamiAnalytics() {
  const websiteId = process.env.UMAMI_WEBSITE_ID;
  const umamiUrl = process.env.UMAMI_URL;

  if (!websiteId || !umamiUrl) {
    return null;
  }

  return (
    <Script
      defer
      src={`${umamiUrl}/script.js`}
      data-website-id={websiteId}
      strategy="afterInteractive"
    />
  );
}
