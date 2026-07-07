# Security headers

The portal is a static site: **GitHub Pages** origin, served through
**Cloudflare** at `andypeterson.dev`. GitHub Pages cannot set custom HTTP
response headers (it ignores `_headers` — that format is Cloudflare Pages /
Netlify, not GitHub Pages). So security headers come from one of two places,
and it's worth being precise about which, because a static origin can protect
itself for some of them and not others.

## Enforcement matrix

| Header | Enforced by | Lives in |
|---|---|---|
| `Content-Security-Policy` | **In-page `<meta>`** (holds even with no edge) | `astro.config.mjs` → `security.csp` |
| `Referrer-Policy` | **In-page `<meta>`** | `src/layouts/BaseLayout.astro` |
| `X-Content-Type-Options: nosniff` | Cloudflare edge rule | `public/_headers` (spec) |
| `X-Frame-Options` / CSP `frame-ancestors` | Cloudflare edge rule | `public/_headers` (spec) |
| `Strict-Transport-Security` | Cloudflare edge rule | `public/_headers` (spec) |
| `Permissions-Policy` | Cloudflare edge rule | `public/_headers` (spec) |

### Why the split

- **CSP and Referrer-Policy** work as `<meta>` tags, so they ship inside the
  HTML and hold regardless of the edge. The CSP is the load-bearing control
  (it blocks injected/exfiltrating scripts); Astro emits a hashed per-page
  policy at build time. `scripts/check-security-headers.sh` runs after
  `npm run build` and fails CI if the policy stops shipping or loses a
  load-bearing directive.
- **`frame-ancestors` is inert in a `<meta>` CSP** — browsers only honor it as
  a real HTTP header. So clickjacking protection genuinely depends on the edge
  rule (`X-Frame-Options` / a header-form `frame-ancestors`), not the meta.
- **`nosniff`, `HSTS`, `Permissions-Policy`** have no `<meta>` form at all;
  they can only be real HTTP headers. A GitHub Pages origin can't set them, so
  they're edge-only.

## `public/_headers` is a spec, not live

The file is kept as the source-of-truth list of intended header values and is
**mirrored by hand** into Cloudflare. It does nothing on the GitHub Pages
origin. Verify the live state with:

```sh
curl -sI https://andypeterson.dev/ | grep -iE 'x-frame|x-content|strict-transport|permissions-policy'
```

If that returns nothing, the Cloudflare rules below haven't been applied yet
(the meta CSP + referrer still hold in the meantime).

## Applying the edge rules (Cloudflare)

Dashboard → the `andypeterson.dev` zone → **Rules → Transform Rules →
Modify Response Header** → *Create rule*, match `hostname eq "andypeterson.dev"`,
and **Set static** each header to the value in `public/_headers`:

| Header | Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(self), microphone=(self), geolocation=()` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |

`Content-Security-Policy` is intentionally **not** duplicated at the edge — the
per-page meta already carries a hashed policy, and a second, hand-maintained
edge copy would drift out of sync with the inline-script hashes Astro computes.

Keep this table and `public/_headers` in step; the values here are the contract.
