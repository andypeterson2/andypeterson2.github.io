# Security headers

The portal is a static site hosted on **Cloudflare Pages** at `andypeterson.dev`.
Cloudflare Pages serves `public/_headers` natively, so the edge security headers
are **live from that file** — there are no hand-maintained Transform Rules to keep
in sync anymore. Two headers still ship in-page via `<meta>` instead, for reasons
worth being precise about (a static host genuinely can't do them as headers).

## Enforcement matrix

| Header | Enforced by | Lives in |
|---|---|---|
| `Content-Security-Policy` | **In-page `<meta>`** (per-page hashed) | `astro.config.mjs` → `security.csp` |
| `Referrer-Policy` | In-page `<meta>` **and** `_headers` | `src/layouts/BaseLayout.astro` + `public/_headers` |
| `X-Content-Type-Options: nosniff` | Cloudflare Pages `_headers` | `public/_headers` |
| `X-Frame-Options: DENY` | Cloudflare Pages `_headers` | `public/_headers` |
| `Strict-Transport-Security` | Cloudflare Pages `_headers` | `public/_headers` |
| `Permissions-Policy` | Cloudflare Pages `_headers` | `public/_headers` |
| `X-XSS-Protection: 0` | Cloudflare Pages `_headers` | `public/_headers` |

### Why the CSP stays in `<meta>`

- The CSP is the load-bearing control (it blocks injected/exfiltrating scripts),
  and Astro emits a **hashed per-page policy** at build time — each page's inline
  `<script>`/`<style>` hashes differ, so a single static `_headers` value can't
  reproduce it. Delivering it in-page via `<meta>` keeps the hashes exact.
  `scripts/check-security-headers.sh` runs after `npm run build` and fails CI if
  the policy stops shipping or loses a load-bearing directive.
- **`frame-ancestors` is inert in a `<meta>` CSP** — browsers only honor it as a
  real header. Clickjacking protection is therefore carried by
  **`X-Frame-Options: DENY`** in `_headers` (the header-form control that
  `frame-ancestors` supersedes but that every browser still enforces).
- **`nosniff`, `HSTS`, `Permissions-Policy`** have no `<meta>` form at all — they
  can only be real HTTP headers, now served straight from `_headers`.

## `public/_headers` is the source of truth (and it's live)

Cloudflare Pages applies it on every response. The values there ARE the contract —
edit that file, not a dashboard rule. Verify production after a deploy:

```sh
scripts/check-security-headers.sh --live https://andypeterson.dev
```

or by hand:

```sh
curl -sI https://andypeterson.dev/ | grep -iE 'x-frame|x-content|strict-transport|permissions-policy|referrer'
```

## Migration note (GitHub Pages → Cloudflare Pages)

Before this migration the origin was GitHub Pages (which ignores `_headers`), so
these headers were mirrored by hand into Cloudflare **Transform Rules**. Those
rules are now redundant and should be deleted so `_headers` is the single source —
if both are active they can conflict or drift. The `<meta>` CSP + referrer policy
were unchanged by the move.
