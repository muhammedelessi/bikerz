import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Fetch published theory courses (this platform's courses are theory by nature)
  const { data: courses, error } = await supabase
    .from('courses')
    .select(
      'id, title, title_ar, description, description_ar, price, discount_percentage, vat_percentage, thumbnail_url, difficulty_level, created_at',
    )
    .eq('is_published', true)
    .order('created_at', { ascending: true });

  if (error) {
    return new Response(`<error>${escapeXml(error.message)}</error>`, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/xml; charset=utf-8' },
    });
  }

  const SITE_URL = 'https://academy.bikerz.com';
  const BRAND = 'Bikerz Academy';
  const CURRENCY = 'SAR';

  const levelLabel: Record<string, string> = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
  };

  const items = (courses || []).map((course: Record<string, unknown>) => {
    const basePrice = Number(course.price) || 0;
    const discount = course.discount_percentage ? Number(course.discount_percentage) : 0;
    const vat = (course.vat_percentage as number | null | undefined) ?? 15;
    const afterDiscount = discount > 0 ? basePrice * (1 - discount / 100) : basePrice;
    const finalPrice = Math.ceil(afterDiscount * (1 + vat / 100));
    const originalPrice = Math.ceil(basePrice * (1 + vat / 100));

    const imageUrl = (course.thumbnail_url as string | null) || `${SITE_URL}/og-image.jpg`;
    const rawDescription = String(course.description || course.title || '');
    const rawTitle = String(course.title || '');

    const description = escapeXml(rawDescription);
    const title = escapeXml(rawTitle);
    const imageLink = escapeXml(imageUrl);
    const link = escapeXml(`${SITE_URL}/courses/${course.id}`);

    const priceStr =
      discount > 0 ? `${originalPrice}.00 ${CURRENCY}` : `${finalPrice}.00 ${CURRENCY}`;
    const salePriceStr = discount > 0 ? `${finalPrice}.00 ${CURRENCY}` : '';

    const level = levelLabel[String(course.difficulty_level)] || 'Beginner';
    const googleCategory = 'Education > Driving & Riding Lessons';

    return `
    <item>
      <g:id>${course.id}</g:id>
      <g:title>${title}</g:title>
      <g:description>${description}</g:description>
      <g:link>${link}</g:link>
      <g:image_link>${imageLink}</g:image_link>
      <g:availability>in stock</g:availability>
      <g:condition>new</g:condition>
      <g:price>${priceStr}</g:price>
      ${salePriceStr ? `<g:sale_price>${salePriceStr}</g:sale_price>` : ''}
      <g:brand>${escapeXml(BRAND)}</g:brand>
      <g:google_product_category>${escapeXml(googleCategory)}</g:google_product_category>
      <g:product_type>Online Course</g:product_type>
      <g:custom_label_0>${escapeXml(level)}</g:custom_label_0>
      <g:custom_label_1>Theory</g:custom_label_1>
      <g:custom_label_2>${escapeXml(BRAND)}</g:custom_label_2>
    </item>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(`${BRAND} Courses`)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(`Motorcycle riding courses by ${BRAND}`)}</description>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
});
