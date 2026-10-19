import type { MetadataRoute } from "next";

// Only the public pages are worth crawling; everything else needs a login anyway.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/signup", "/login", "/terms", "/privacy", "/marketing/"], disallow: ["/api/", "/dashboard", "/admin"] },
    sitemap: "https://www.crewandgrounds.com/sitemap.xml",
  };
}
