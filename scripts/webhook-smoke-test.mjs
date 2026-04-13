/**
 * Webhook smoke test — sends labeled test payloads matching app shapes.
 * Keep URLs in sync with: src/services/ghl.service.ts, src/pages/PaymentSuccess.tsx,
 * supabase/functions/community-webhook, supabase/functions/ghl-sync.
 *
 * Usage:
 *   node scripts/webhook-smoke-test.mjs
 * Optional (community edge + ghl-sync test_ping):
 *   set VITE_SUPABASE_URL=... & set VITE_SUPABASE_PUBLISHABLE_KEY=... & node scripts/webhook-smoke-test.mjs
 */

const TAG = "[webhook-smoke]";

const GHL_FORM_WEBHOOK =
  "https://services.leadconnectorhq.com/hooks/ddAvdgekc94cWL9NBHK1/webhook-trigger/0c004a12-e140-49df-8fcf-b62b101c4e8c";

const GHL_COMMUNITY_WEBHOOK =
  "https://services.leadconnectorhq.com/hooks/ddAvdgekc94cWL9NBHK1/webhook-trigger/01def5f1-e7d8-48f1-ba1c-dabc36400e13";

const GHL_SYNC_WEBHOOK =
  "https://services.leadconnectorhq.com/hooks/ddAvdgekc94cWL9NBHK1/webhook-trigger/f05b897f-940c-490b-8a3a-8261ab0ec064";

/** Server-only Tap settlement → GHL (supabase/functions/tap-webhook); differs from frontend form webhook ID. */
const GHL_TAP_SERVER_WEBHOOK =
  "https://services.leadconnectorhq.com/hooks/ddAvdgekc94cWL9NBHK1/webhook-trigger/9a3cf7c3-0405-4667-ad02-e9c89073feb4";

const N8N_NEW_ORDER = "https://n8n.srv1504278.hstgr.cloud/webhook/new_order";
const N8N_WEBHOOK_TEST = "https://n8n.srv1504278.hstgr.cloud/webhook-test/fec802fa-f0c5-45e9-b9c9-3ecb0ecbc5c3";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @type {'critical' | 'optional'} */
async function postJson(url, body, label, tier = "critical") {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    const ok = res.ok;
    const n8nInactive = url.includes("n8n.") && (res.status === 404 || /not registered/i.test(text));
    const tag = ok ? "OK" : tier === "optional" && n8nInactive ? "WARN" : "FAIL";
    console.log(
      `${TAG} ${tag} ${label} → ${res.status} (${Date.now() - started}ms)`,
      text.length > 200 ? `${text.slice(0, 200)}…` : text || "(empty body)",
    );
    if (!ok && tier === "optional" && n8nInactive) {
      console.log(
        `${TAG}     (n8n: activate the workflow or use “Execute workflow” for test URLs — not an app code error)`,
      );
    }
    return { ok, status: res.status, label, tier, optionalInactive: !ok && tier === "optional" && n8nInactive };
  } catch (e) {
    console.error(`${TAG} ERROR ${label}:`, e?.message || e);
    return { ok: false, status: 0, label, tier, error: String(e) };
  }
}

function baseEmail() {
  const t = Date.now();
  return `webhook.smoke.${t}@example.com`;
}

/** Same field names as sendGHLFormData() payload (client-side transform already applied). */
function ghlFormBody(overrides) {
  const email = overrides.email ?? baseEmail();
  return {
    full_name: overrides.full_name ?? "Smoke Test User",
    email,
    phone: overrides.phone ?? "+966500000001",
    country: overrides.country ?? "SA",
    city: overrides.city ?? "Riyadh",
    address: overrides.address ?? "Riyadh, SA",
    courseName: overrides.courseName ?? "",
    amount: overrides.amount ?? "",
    currency: overrides.currency ?? "",
    orderStatus: overrides.orderStatus ?? "not purchased",
    courses: overrides.courses ?? "[]",
    totalPurchased: overrides.totalPurchased ?? 0,
    dateOfBirth: overrides.dateOfBirth ?? "",
    gender: overrides.gender ?? "",
    source: "webhook_smoke_test",
    ticket_subject: overrides.ticket_subject ?? "",
    ticket_message: overrides.ticket_message ?? "",
    ticket_category: overrides.ticket_category ?? "",
  };
}

async function main() {
  const email = baseEmail();
  console.log(`${TAG} Starting smoke run, marker email: ${email}\n`);

  const results = [];

  // --- GHL form webhook (all flows that use sendGHLFormData / sendCourseStatus / sendWithCourses) ---
  const ghlFormScenarios = [
    ["GHL form: signup / guest", ghlFormBody({ email, orderStatus: "not purchased" })],
    [
      "GHL form: contact ticket",
      ghlFormBody({
        email,
        courseName: "Contact / support",
        ticket_subject: "[SMOKE] Support subject",
        ticket_message: "[SMOKE] Message body",
        ticket_category: "technical",
        orderStatus: "not purchased",
      }),
    ],
    [
      "GHL form: course pending checkout",
      ghlFormBody({
        email,
        courseName: "Intro Course",
        amount: "299",
        currency: "SAR",
        orderStatus: "pending",
        courses: JSON.stringify([{ id: "smoke-course", name: "Intro Course", status: "pending" }]),
        totalPurchased: 0,
      }),
    ],
    [
      "GHL form: course purchased",
      ghlFormBody({
        email,
        courseName: "Intro Course",
        amount: "299",
        currency: "SAR",
        orderStatus: "purchased",
        courses: JSON.stringify([{ id: "smoke-course", name: "Intro Course", status: "purchased" }]),
        totalPurchased: 1,
      }),
    ],
    [
      "GHL form: bundle purchased",
      ghlFormBody({
        email,
        courseName: "Course bundle",
        amount: "999",
        currency: "SAR",
        orderStatus: "purchased",
        courses: JSON.stringify([
          { id: "a", name: "Course A", status: "purchased" },
          { id: "b", name: "Course B", status: "purchased" },
        ]),
        totalPurchased: 2,
      }),
    ],
    [
      "GHL form: profile completion",
      ghlFormBody({
        email,
        dateOfBirth: "1990-01-15",
        gender: "male",
        orderStatus: "purchased",
        courses: "[]",
        totalPurchased: 1,
      }),
    ],
  ];

  for (const [label, body] of ghlFormScenarios) {
    results.push(await postJson(GHL_FORM_WEBHOOK, body, label, "critical"));
    await sleep(250);
  }

  // --- n8n (PaymentSuccess shapes) ---
  const n8nBundle = {
    email,
    full_name: "Smoke Bundle Buyer",
    phone: "+966500000002",
    courseName: "Course bundle",
    amount: "1499",
    currency: "SAR",
    orderStatus: "purchased",
    is_bundle: true,
    payment_id: `smoke_tap_bundle_${Date.now()}`,
    date: new Date().toISOString(),
  };
  results.push(await postJson(N8N_NEW_ORDER, n8nBundle, "n8n new_order: bundle", "optional"));
  await sleep(250);

  const n8nSingle = {
    email,
    full_name: "Smoke Single Buyer",
    phone: "+966500000003",
    courseName: "Single Course",
    amount: "199",
    currency: "SAR",
    orderStatus: "purchased",
    is_bundle: false,
    payment_id: `smoke_tap_single_${Date.now()}`,
    date: new Date().toISOString(),
  };
  results.push(await postJson(N8N_NEW_ORDER, n8nSingle, "n8n new_order: single", "optional"));
  await sleep(250);

  const n8nTestExtended = {
    ...n8nSingle,
    country: "SA",
    city: "Riyadh",
    course_id: "smoke-course-id",
    course_name: "Smoke Course",
    amount: 199,
    purchase_date: new Date().toISOString(),
    order_status: "purchased",
  };
  results.push(
    await postJson(N8N_WEBHOOK_TEST, n8nTestExtended, "n8n webhook-test: PaymentSuccess DEV shape", "optional"),
  );
  await sleep(250);

  // --- GHL community (same payload as community-webhook edge → GHL) ---
  results.push(
    await postJson(
      GHL_COMMUNITY_WEBHOOK,
      {
        full_name: "Smoke Community",
        phone: "+966500000004",
        email: `community.smoke.${Date.now()}@example.com`,
        country: "Saudi Arabia",
        city: "Jeddah",
        has_motorcycle: true,
        considering_purchase: "N/A",
        submitted_at: new Date().toISOString(),
      },
      "GHL direct: community funnel",
      "critical",
    ),
  );
  await sleep(250);

  // --- GHL sync webhook (same shape as ghl-sync test_ping → GHL) ---
  results.push(
    await postJson(
      GHL_SYNC_WEBHOOK,
      {
        event: "test_ping",
        email: `sync.smoke.${Date.now()}@example.com`,
        full_name: "Smoke Rider — GHL sync test_ping",
        phone: "+966500000005",
        city: "Riyadh",
        country: "Saudi Arabia",
        experience_level: "intermediate",
        bike_brand: "Yamaha",
        bike_model: "MT-07",
        tags: "test,academy-student,webhook_smoke",
        source: "Bikerz Academy",
        timestamp: new Date().toISOString(),
      },
      "GHL direct: ghl-sync test_ping shape",
      "critical",
    ),
  );
  await sleep(250);

  // --- GHL: same endpoint as tap-webhook edge (charge lifecycle) ---
  results.push(
    await postJson(
      GHL_TAP_SERVER_WEBHOOK,
      {
        email: `tap.smoke.${Date.now()}@example.com`,
        phone: "+966500000007",
        full_name: "Smoke Tap Webhook Shape",
        city: "Riyadh",
        country: "SA",
        address: "Riyadh, SA",
        courseName: "Smoke Course (tap shape)",
        amount: "199",
        source: "webhook_smoke_test",
        orderStatus: "purchased",
        courses: JSON.stringify([{ id: "x", name: "Smoke Course (tap shape)", status: "purchased" }]),
        totalPurchased: 1,
      },
      "GHL direct: tap-webhook server payload shape",
      "critical",
    ),
  );
  await sleep(250);

  // --- Supabase edge: community-webhook (optional) ---
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (supabaseUrl && supabaseKey) {
    const edgeUrl = `${supabaseUrl}/functions/v1/community-webhook`;
    try {
      const res = await fetch(edgeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
        },
        body: JSON.stringify({
          full_name: "Smoke Edge Community",
          phone: "+966500000006",
          email: `edge.community.smoke.${Date.now()}@example.com`,
          country: "United Arab Emirates",
          city: "Dubai",
          has_motorcycle: false,
          considering_purchase: "within_6_months",
        }),
      });
      const text = await res.text();
      console.log(
        `${TAG} ${res.ok ? "OK" : "FAIL"} Supabase community-webhook → ${res.status}`,
        text.slice(0, 300),
      );
      results.push({ ok: res.ok, status: res.status, label: "edge community-webhook" });
    } catch (e) {
      console.error(`${TAG} ERROR edge community-webhook:`, e?.message || e);
      results.push({ ok: false, label: "edge community-webhook", error: String(e) });
    }
    await sleep(250);

    // ghl-sync test_ping (no user JWT required)
    const ghlSyncUrl = `${supabaseUrl}/functions/v1/ghl-sync`;
    try {
      const res = await fetch(ghlSyncUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
        },
        body: JSON.stringify({ action: "test_ping" }),
      });
      const text = await res.text();
      console.log(`${TAG} ${res.ok ? "OK" : "FAIL"} Supabase ghl-sync test_ping → ${res.status}`, text.slice(0, 400));
      results.push({ ok: res.ok, status: res.status, label: "edge ghl-sync test_ping" });
    } catch (e) {
      console.error(`${TAG} ERROR edge ghl-sync:`, e?.message || e);
      results.push({ ok: false, label: "edge ghl-sync test_ping", error: String(e) });
    }
  } else {
    console.log(
      `${TAG} Skip Supabase edge tests (set VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY to enable).`,
    );
  }

  const criticalFailed = results.filter((r) => r.tier === "critical" && !r.ok);
  const optionalWarn = results.filter((r) => r.tier === "optional" && !r.ok);
  console.log(
    `\n${TAG} Summary: critical OK ${results.filter((r) => r.tier === "critical" && r.ok).length}/${
      results.filter((r) => r.tier === "critical").length
    }` +
      (optionalWarn.length
        ? ` | n8n optional: ${optionalWarn.length} not OK (check n8n workflow activation)`
        : " | n8n optional: all OK"),
  );
  if (criticalFailed.length) {
    console.error(`${TAG} Critical failures: ${criticalFailed.map((f) => f.label).join(", ")}`);
  }
  process.exit(criticalFailed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(TAG, e);
  process.exit(1);
});
