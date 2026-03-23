

## Fix: Card Payments Stuck at INITIATED/Processing

### Root Cause Analysis

After investigating all card payment records, the pattern is clear:

- **Every single card payment** uses `source: { id: "src_all" }` (Tap redirect flow)
- **All stay at `INITIATED` status** with `redirect.status: PENDING` and `webhook_verified: false`
- **Apple Pay / mada payments succeed** because they use direct tokenization (no redirect)

**Three issues cause this:**

1. **Wrong redirect domain** — Some charges redirect to the Lovable preview URL instead of the published domain (`academy.bikerz.com`). This causes session loss after the user returns from Tap's hosted page, so the verify call fails with 401.

2. **Verification requires auth + user_id match** — The `tap-verify-charge` function requires a valid JWT AND filters by `user_id`. If the user's session is lost during the external redirect (common on mobile Safari due to ITP), verification silently fails.

3. **No webhook updates** — The `tap-webhook` edge function exists but Tap is not configured to send webhooks to it. `webhook_verified` is `false` on every record. This server-side safety net is completely non-functional.

### Plan

**Step 1: Fix redirect URL in `tap-create-charge`**
- Hardcode the redirect URL to the published domain instead of deriving from `req.headers.get("origin")`, which returns the preview URL during development
- Use `https://academy.bikerz.com/payment-success?course=XXX` consistently

**Step 2: Make `tap-verify-charge` work without strict user auth**
- Allow unauthenticated verification: if no valid JWT, still verify the charge with Tap API and update the DB record (using service role)
- Remove the `eq("user_id", userId)` filter when the user can't be authenticated — the charge_id itself is sufficient proof (it's a server-generated opaque token)
- Still perform enrollment and revenue tracking on success

**Step 3: Add retry + fallback in `PaymentSuccess` page**
- If the first verify call fails (e.g., 401), retry without auth by calling the function directly
- Add polling: retry verification 3 times with 3-second intervals for charges still in `processing`
- Show a clear "still processing" state instead of immediately showing failure

**Step 4: Fix `useTapPayment` redirect return handling**
- The `useEffect` in `useTapPayment` also checks for `tap_id` but runs inside the checkout modal (which is closed after redirect). Move/duplicate this logic to be more resilient.

**Step 5: Inform about webhook configuration**
- After implementation, provide the webhook URL that needs to be configured in the Tap dashboard: `https://gifovgwlxwuiibfzyvwb.supabase.co/functions/v1/tap-webhook`

### Technical Details

**Files to modify:**
- `supabase/functions/tap-create-charge/index.ts` — Fix redirect URL
- `supabase/functions/tap-verify-charge/index.ts` — Remove strict auth requirement, add enrollment logic
- `src/pages/PaymentSuccess.tsx` — Add retry/polling logic
- `src/hooks/useTapPayment.ts` — Improve redirect return handling

**Key code change in `tap-verify-charge`:**
```text
Before: Requires JWT → gets userId → filters by charge_id + user_id
After:  Optional JWT → if authenticated filter by user_id, if not just use charge_id → verify with Tap API → update DB + enroll
```

**Key code change in `tap-create-charge`:**
```text
Before: const origin = req.headers.get("origin") || "https://bikerz.lovable.app";
After:  const origin = "https://academy.bikerz.com";
```

