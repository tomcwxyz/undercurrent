import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/onboarding",
        "/admin",
        "/referral",
        "/api/",
        "/check-email",
        "/forgot-password",
        "/reset-password",
        "/invite/",
      ],
    },
    sitemap: "https://swells.app/sitemap.xml",
  };
}
