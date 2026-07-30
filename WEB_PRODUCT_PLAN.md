# ClearRent Web — Product Plan

Written 2026-07-30. Extends the existing marketing site (`clearrent_web`, Next.js 16 /
React 19 / Tailwind 3, deployed on Vercel, branch `develop`).

---

## Decisions locked

| Decision | Choice |
|---|---|
| Scope | **Public browse + tenant entry.** Landlord and agent operations stay mobile-only. |
| Location | **Extend `clearrent_web`** — one domain, shared brand and legal pages. |
| Rendering | **Server-rendered via `firebase-admin`.** Not client Firestore reads. |
| Firestore rules | **Unchanged.** No loosening for the web. |

---

## Why server-rendered, not client Firestore

Verified in `clearrent/firestore.rules:177`:

```
match /properties/{propertyId} {
  allow read: if request.auth != null;
```

Listings are **not publicly readable**, so an anonymous visitor cannot read them from the
client. Three reasons the server-side fix is the right answer rather than a workaround:

1. **Rules stay locked.** No public exposure of the `properties` collection.
2. **Field projection.** Firestore rules cannot filter *fields* — a public client read
   would leak the entire document (`landlordId`, payout data, ownership doc status, exact
   coordinates). Server-side we emit only what is safe.
3. **SEO.** Property pages must be real HTML for crawlers. This is the whole commercial
   point of the web surface.

---

## Phase 1 — Public browse (no auth, no App Check, no payments)

Independently shippable. Satisfies Paystack's outstanding "go live and be reviewable"
requirement, which is currently blocked by the site being waitlist-only.

### Routes
- `/properties` — list with filters: state, city, LGA, property type, bedrooms, rent band.
- `/properties/[id]` — indexable detail page.
- `/sitemap.xml` — generated from published listings.

### Detail page content
Title, images, video, bedrooms/bathrooms/toilets, amenities, recurring dues, and the full
package: rent + agent fee + **caution deposit including its refundability line**
(`cautionDepositRefundable`, shipped 2026-07-30).

### Publication gate — do not skip
Only publish a property when **all** hold:
- `isAvailable == true`
- `readyForInspections == true`
- effective `ownershipDocStatus == 'verified'` — resolve `'inherited'` through the
  building, never treat the marker as approval

Publishing unvetted listings publicly would undercut the verification promise the platform
is sold on. Mirror the app's allowlist logic exactly.

### Never emit to the client
`address` / exact street address, `latitude` / `longitude`, `landlordId`, payout or
earnings fields, `ownershipDocUrl`, `ownershipDocStatus`, `private/location` subdoc.

Public pages show `approximateAddress` (LGA, city, state) only. The exact address is
released after inspection approval — that gating already exists and ports unchanged.

### CTA
Deep-link to the app (or a "get the app" interstitial) until Phase 2 lands.

---

## Phase 2 — Tenant entry

Sign-up / sign-in with the Firebase Web SDK, then request an inspection.

**Do App Check first, not last.** Web cannot use Play Integrity — it needs reCAPTCHA v3 or
Enterprise, registered separately in the Firebase console. These callables are
`enforceAppCheck: true` and will fail with `unauthenticated` until the web provider works:

```
createRentalInterest, recordRentPayment, confirmInspectionPayment,
initializePayment, verifyPayment, refundPayment, resolveAccount,
submitNin, deleteMyAccount, getSignedAgreementUrl, agentUnassignFromProperty
```

A day was lost on 2026-07-29/30 to exactly this failure mode on Android, where App Check
rejection surfaces as `unauthenticated` and the client mislabels it "session expired".
Expect the same confusion on web and wire it deliberately.

Also required: tenant verification + NIN before booking, and a web path for Paystack
(current flow assumes the mobile SDK).

---

## Cross-cutting

- **Service account on Vercel.** Do NOT reuse `clearrent/functions/serviceAccountKey.json`.
  Mint a dedicated account with the narrowest workable role and store it in Vercel env vars.
- **Caching.** Listing pages should use ISR/revalidation — Firestore reads on every request
  will be slow and costly.
- **Brand assets.** `clearrent_lockup_*.svg` handoff for headers/footers is still open.

---

## State of the world (2026-07-30)

- Production data was wiped to a clean slate: only the two admin accounts remain
  (`oredugbamide@gmail.com` superAdmin, `mide@verealtytech.com` admin), verified and intact.
  Backup at `gs://clearrent-app-firestore-backups/2026-07-30-pre-wipe`.
- **There are currently zero properties**, so Phase 1 has nothing to render until listings
  are recreated during the end-to-end test.
- ~473 orphaned documents (activities, notifications, payments, conversations) referencing
  the kept admins survived the wipe and are **not yet cleaned up** — decision outstanding.

---

## Open questions

1. Domain/route shape — `verealtytech.com/properties`, or a `clearrent.` subdomain?
2. Does the waitlist landing page stay as the homepage, or does browse become the homepage?
3. Search — Firestore queries only, or an index (Algolia/Typesense) for text search?
   Firestore alone cannot do full-text; area/type/price filters are fine.
