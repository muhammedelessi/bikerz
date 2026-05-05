import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BASE = "https://academy.bikerz.com";
const TODAY = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

/**
 * Dynamic XML sitemap generator.
 *
 * Queries Supabase for all published courses, trainings, and trainers,
 * then builds a valid sitemap.xml that Google / Bing can consume.
 *
 * Static pages are hardcoded below; dynamic pages come from the DB.
 * Cache: 1 hour via CDN (s-maxage) + 6 hours stale-while-revalidate.
 */

interface SitemapEntry {
  loc: string;
  priority: string;
  changefreq: string;
  lastmod?: string;
}

// ── Static public pages ─────────────────────────────────────────────
const STATIC_PAGES: SitemapEntry[] = [
  // High priority — main landing pages
  { loc: "/", priority: "1.0", changefreq: "daily" },
  { loc: "/courses", priority: "0.9", changefreq: "daily" },
  { loc: "/bundles", priority: "0.9", changefreq: "weekly" },
  { loc: "/trainings", priority: "0.9", changefreq: "weekly" },
  { loc: "/trainers", priority: "0.8", changefreq: "weekly" },

  // Medium priority — informational pages
  { loc: "/about", priority: "0.7", changefreq: "monthly" },
  { loc: "/contact", priority: "0.7", changefreq: "monthly" },
  { loc: "/join-community", priority: "0.7", changefreq: "monthly" },
  { loc: "/community-champions", priority: "0.7", changefreq: "weekly" },
  { loc: "/ambassador", priority: "0.6", changefreq: "monthly" },

  // Auth pages — included so Google shows sitelinks
  { loc: "/signup", priority: "0.5", changefreq: "monthly" },
  { loc: "/login", priority: "0.4", changefreq: "monthly" },

  // Legal — low priority
  { loc: "/privacy", priority: "0.2", changefreq: "yearly" },
  { loc: "/terms", priority: "0.2", changefreq: "yearly" },
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build a sitemap entry per language variant. URL convention:
 *   - Arabic (default): bare path  → https://academy.bikerz.com/courses
 *   - English:          /en prefix → https://academy.bikerz.com/en/courses
 * Each <url> includes hreflang alternates so Google indexes both.
 */
function buildUrlEntry(entry: SitemapEntry): string {
  const lastmod = entry.lastmod || TODAY;
  const arPath = entry.loc;
  const enPath = entry.loc === "/" ? "/en" : `/en${entry.loc}`;
  const arUrl = BASE + arPath;
  const enUrl = BASE + enPath;

  const alternates = `    <xhtml:link rel="alternate" hreflang="ar" href="${escapeXml(arUrl)}" />
    <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(enUrl)}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(arUrl)}" />`;

  const arEntry = `  <url>
    <loc>${escapeXml(arUrl)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
${alternates}
  </url>`;

  const enEntry = `  <url>
    <loc>${escapeXml(enUrl)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
${alternates}
  </url>`;

  return `${arEntry}\n${enEntry}`;
}

Deno.serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(supabaseUrl, supabaseKey);

    // Fetch all published/visible dynamic content in parallel
    const [coursesRes, trainingsRes, trainersRes, championsRes] = await Promise.all([
      client
        .from("courses")
        .select("id, updated_at")
        .order("created_at", { ascending: false }),
      client
        .from("trainings")
        .select("id, updated_at")
        .order("created_at", { ascending: false }),
      client
        .from("trainers")
        .select("id, updated_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      client
        .from("community_champions")
        .select("id, updated_at")
        .order("created_at", { ascending: false }),
    ]);

    // Build dynamic entries
    const dynamicEntries: SitemapEntry[] = [];

    // Individual course pages
    if (coursesRes.data) {
      for (const c of coursesRes.data) {
        dynamicEntries.push({
          loc: `/courses/${c.id}`,
          priority: "0.8",
          changefreq: "weekly",
          lastmod: c.updated_at?.split("T")[0],
        });
      }
    }

    // Individual training pages
    if (trainingsRes.data) {
      for (const t of trainingsRes.data) {
        dynamicEntries.push({
          loc: `/trainings/${t.id}`,
          priority: "0.7",
          changefreq: "weekly",
          lastmod: t.updated_at?.split("T")[0],
        });
      }
    }

    // Individual trainer profiles
    if (trainersRes.data) {
      for (const tr of trainersRes.data) {
        dynamicEntries.push({
          loc: `/trainers/${tr.id}`,
          priority: "0.6",
          changefreq: "monthly",
          lastmod: tr.updated_at?.split("T")[0],
        });
      }
    }

    // Community champion pages
    if (championsRes.data) {
      for (const ch of championsRes.data) {
        dynamicEntries.push({
          loc: `/community-champions/${ch.id}`,
          priority: "0.5",
          changefreq: "monthly",
          lastmod: ch.updated_at?.split("T")[0],
        });
      }
    }

    // Combine static + dynamic
    const allEntries = [...STATIC_PAGES, ...dynamicEntries];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${allEntries.map(buildUrlEntry).join("\n")}
</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        // CDN caches for 1 hour, serves stale for up to 6 hours while revalidating
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Sitemap generation error:", error);
    // Return a minimal static sitemap on error so Google still gets something
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${STATIC_PAGES.map(buildUrlEntry).join("\n")}
</urlset>`;
    return new Response(fallback, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=300",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
