import type { MetadataRoute } from "next";

const SITE = "https://www.crewandgrounds.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE}/signup`, changeFrequency: "yearly", priority: 0.8 },
    { url: `${SITE}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
