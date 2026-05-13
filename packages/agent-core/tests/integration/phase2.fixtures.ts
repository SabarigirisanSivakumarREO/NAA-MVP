/**
 * Phase 2 integration test fixtures (T050).
 *
 * Split out of `phase2.test.ts` to keep the main file under R10.1's 300 LOC
 * cap. These mirror the fixtures pinned in `tests/conformance/page-analyze-v23.test.ts`
 * — the namespace contract block re-exercises page_analyze on all three so any
 * fixture drift between Phase 2 conformance and integration is caught here.
 *
 * Source:
 *   docs/specs/mvp/phases/phase-2-tools/spec.md AC-13 + R-15 + SC-001
 *   docs/specs/mvp/phases/phase-2-tools/tasks.md T050 brief (amazon.in OR
 *     stable fixture if amazon.in flakes)
 *
 * R10.1: under 300 LOC. R10.3: named exports only.
 */

/**
 * Homepage fixture — verbatim copy of `page-analyze-v23.test.ts`
 * HOMEPAGE_FIXTURE. YouTube iframe → IframePolicyEngine classifies as `video`.
 */
export const HOMEPAGE_FIXTURE =
  '<!doctype html><html lang="en"><head>' +
  '<title>Acme Widgets — Tools for makers</title>' +
  '<meta name="description" content="Premium widgets for makers.">' +
  '<link rel="canonical" href="https://acme.example/">' +
  '<meta property="og:title" content="Acme Widgets">' +
  '<meta property="og:description" content="Premium widgets for makers.">' +
  '<meta property="og:image" content="https://acme.example/og.png">' +
  '</head><body>' +
  '<nav><a href="/">Home</a><a href="/shop">Shop</a><a href="/about">About</a><a href="/contact">Contact</a></nav>' +
  '<main><h1>Tools for makers</h1>' +
  '<h2>Built to last a lifetime — limited time 30-day money-back guarantee</h2>' +
  '<p>Welcome to Acme. Free returns on every order.</p>' +
  '<a href="/shop" id="cta-primary" class="cta">Shop now</a>' +
  '<a href="/learn" id="cta-secondary">Learn more</a>' +
  '<span class="trust">Trusted by 10,000 customers</span>' +
  '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="560" height="315"></iframe>' +
  '</main>' +
  '<footer><div><h3>Company</h3><a href="/about">About</a><a href="/careers">Careers</a></div>' +
  '<div><h3>Support</h3><a href="/help">Help</a><a href="/contact">Contact</a></div></footer>' +
  '</body></html>';

/**
 * Product detail page fixture — Stripe iframe → IframePolicyEngine classifies
 * as `checkout`. Schema.org Product JSON-LD picked up by metadata extractor.
 */
export const PDP_FIXTURE =
  '<!doctype html><html lang="en"><head>' +
  '<title>Acme Widget Pro — Product</title>' +
  '<meta name="description" content="The Acme Widget Pro.">' +
  '<script type="application/ld+json">{"@type":"Product","name":"Acme Widget Pro","offers":{"@type":"Offer","price":"99"}}</script>' +
  '</head><body>' +
  '<main><h1>Acme Widget Pro</h1>' +
  '<span class="price">$99</span>' +
  '<p>The Acme Widget Pro is the ultimate maker tool.</p>' +
  '<button id="add-cart" class="cta">Add to Cart</button>' +
  '<button id="buy-now">Buy Now</button>' +
  '<section class="reviews"><span class="review">4.7 stars — verified review</span></section>' +
  '<iframe src="https://js.stripe.com/v3/elements-inner-card-abc" width="400" height="300"></iframe>' +
  '</main></body></html>';

/**
 * Checkout fixture — 3DSecure iframe → IframePolicyEngine classifies as
 * `payment_3ds`. inferredPageType.primary contains "checkout".
 */
export const CHECKOUT_FIXTURE =
  '<!doctype html><html lang="en"><head><title>Checkout — Acme</title></head>' +
  '<body><main><h1>Checkout</h1>' +
  '<form id="checkout-form">' +
  '<label for="email">Email</label><input id="email" type="email" required>' +
  '<label for="name">Name</label><input id="name" type="text" required>' +
  '<label for="address">Address</label><input id="address" type="text">' +
  '<label for="country">Country</label><select id="country"><option>US</option><option>IN</option></select>' +
  '<button type="submit">Place Order</button>' +
  '</form>' +
  '<iframe src="https://3dsecure.io/challenge/abc123" width="400" height="400"></iframe>' +
  '</main></body></html>';

/**
 * Tool-exercise fixture — a synthetic deterministic DOM hosting every selector
 * + interaction surface the `browser_*` tools need. Used to exercise the 22
 * browser_* tools against a known DOM instead of amazon.in (which is
 * non-deterministic due to overlays / A/B tests / geo-flake). The wall-clock
 * test exercises a small subset against amazon.in directly when network is up.
 */
export const TOOL_EXERCISE_FIXTURE =
  '<!doctype html><html lang="en"><head>' +
  '<title>Phase 2 integration target</title>' +
  '<meta name="description" content="Synthetic exercise target for AC-13.">' +
  '</head><body>' +
  '<main>' +
  '<h1 id="hero">Phase 2 integration target</h1>' +
  '<a id="nav-link" href="https://example.com/about">About</a>' +
  '<button id="primary-cta" class="cta">Add to cart</button>' +
  '<input id="email" type="email" placeholder="email@example.com">' +
  '<select id="country"><option value="us">US</option><option value="in">IN</option></select>' +
  '<form><input type="file" id="upload-input"></form>' +
  '<span id="invisible" hidden>hidden text</span>' +
  '<a id="dl" href="/some.pdf" download>Download PDF</a>' +
  '<p id="findable-text">unique-needle-token-for-find-by-text</p>' +
  '</main></body></html>';
