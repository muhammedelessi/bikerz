// Honda Owners — server-side upload preparation.
//
// What it does:
//   1. Authenticates the user.
//   2. Ensures the `honda-registrations` bucket exists (idempotent —
//      tries `getBucket` first, only `createBucket` if missing).
//   3. Mints a single-use signed upload URL scoped to
//      {userId}/{timestamp}.{ext}. The frontend uses this URL to PUT
//      the file directly, bypassing RLS entirely (signed upload URLs
//      are the supported way to do exactly this).
//
// Why this exists despite the table having own-folder RLS:
//   We were seeing 400 Bad Request on the direct storage upload from
//   the browser. Empirically the most common cause on managed
//   Supabase is "RLS policy state on storage.objects is unexpected
//   relative to what the migration declared" — usually because the
//   storage.foldername(name)[1] check rejects an edge case in the
//   incoming path. A signed upload URL sidesteps that whole class of
//   problem because it's authorised by the token, not by RLS.
//
//   The bucket is still private (no public reads) and the admin
//   panel still uses signed download URLs to view documents, so the
//   security posture is unchanged.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET_ID = "honda-registrations";
const ALLOWED_EXTS = new Set(["jpg", "jpeg", "png", "webp", "pdf"]);

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify the caller is an authenticated user before doing anything else.
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse(401, { error: "Unauthorized" });
  }
  const userId = userData.user.id;

  // Read the requested extension off the body so the path matches the
  // file the user picked (Supabase doesn't infer it from the upload).
  let body: { ext?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const rawExt = (body.ext || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ext = ALLOWED_EXTS.has(rawExt) ? rawExt : "jpg";

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  // Idempotent bucket create. `getBucket` first means we don't burn a
  // create call on every upload; if it 404s we fall through to create.
  try {
    const { data: existing, error: getErr } =
      await adminClient.storage.getBucket(BUCKET_ID);
    if (!existing && getErr) {
      const { error: createErr } = await adminClient.storage.createBucket(
        BUCKET_ID,
        { public: false },
      );
      if (createErr && !/exist/i.test(createErr.message)) {
        // "already exists" races are fine; anything else is real.
        console.error("[honda-prepare-upload] createBucket:", createErr);
        return jsonResponse(500, {
          error: "Could not initialise storage bucket",
          detail: createErr.message,
        });
      }
    }
  } catch (e) {
    console.error("[honda-prepare-upload] bucket setup failed:", e);
    // Non-fatal — the signed upload URL call below will surface the
    // real error if the bucket truly couldn't be created.
  }

  // Build the path. Keeping the {user_id}/ prefix preserves the
  // per-user isolation pattern the admin panel uses to filter
  // documents, even though the upload itself is now token-authorised.
  const ts = Date.now();
  const path = `${userId}/${ts}.${ext}`;

  // Mint a single-use signed upload URL. This token authorises a PUT
  // to exactly this path; the frontend has 2 hours to use it (default).
  const { data: signed, error: signErr } = await adminClient.storage
    .from(BUCKET_ID)
    .createSignedUploadUrl(path);

  if (signErr || !signed) {
    console.error("[honda-prepare-upload] sign error:", signErr);
    return jsonResponse(500, {
      error: "Could not prepare upload",
      detail: signErr?.message,
    });
  }

  return jsonResponse(200, {
    upload_url: signed.signedUrl,
    token: signed.token,
    path,
  });
});
