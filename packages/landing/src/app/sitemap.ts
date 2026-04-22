import type { MetadataRoute } from "next";

const SITE_URL = "https://vibesmith.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/download`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
