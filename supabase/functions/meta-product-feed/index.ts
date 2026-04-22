import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    .select('id, title, title_ar, description, description_ar, price, discount_percentage, vat_percentage, thumbnail_url, difficulty_level, created_at')
    .eq('is_published', true)
    .order('created_at', { ascending: true });

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const SITE_URL = 'https://academy.bikerz.com';
  const BRAND = 'Bikerz Academy';
  const CURRENCY = 'SAR';

  const levelLabel: Record<string, string> = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
  };

  const feed = (courses || []).map((course: any) => {
    const basePrice = Number(course.price) || 0;
    const discount = course.discount_percentage ? Number(course.discount_percentage) : 0;
    const vat = course.vat_percentage ?? 15;
    const afterDiscount = discount > 0 ? basePrice * (1 - discount / 100) : basePrice;
    const finalPrice = Math.ceil(afterDiscount * (1 + vat / 100));
    const originalPrice = Math.ceil(basePrice * (1 + vat / 100));

    const item: Record<string, unknown> = {
      id: course.id,
      title: course.title,
      title_ar: course.title_ar,
      description: course.description || course.title,
      availability: 'in stock',
      condition: 'new',
      price: `${finalPrice}.00 ${CURRENCY}`,
      link: `${SITE_URL}/courses/${course.id}`,
      image_link: course.thumbnail_url || `${SITE_URL}/og-image.jpg`,
      brand: BRAND,
      category: 'Education > Driving & Riding Lessons',
      product_type: 'Online Course',
      custom_label_0: levelLabel[course.difficulty_level] || 'Beginner',
      custom_label_1: 'Theory',
      custom_label_2: BRAND,
    };

    if (discount > 0) {
      item.price = `${originalPrice}.00 ${CURRENCY}`;
      item.sale_price = `${finalPrice}.00 ${CURRENCY}`;
    }

    return item;
  });

  return new Response(
    JSON.stringify(feed, null, 2),
    {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
});
