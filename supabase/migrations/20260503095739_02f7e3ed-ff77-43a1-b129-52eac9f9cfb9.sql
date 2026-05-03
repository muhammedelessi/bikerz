
-- Column-level revoke: anon/authenticated cannot SELECT video_url or content fields
-- directly from base table. Only via lessons_public view (enrollment-aware) or by admin role.
REVOKE SELECT (video_url, content_html, content_html_ar) ON public.lessons FROM anon, authenticated;
