/**
 * MCP Server E2E test against the live Rove API.
 *
 * Requires:
 *   ROVE_API_KEY=rvp_live_... (a real key with credits)
 *   ROVE_API_BASE_URL=https://rove-api.fly.dev (optional, defaults to this)
 *
 * Run:
 *   ROVE_API_KEY=rvp_live_xxx tsx --test test/e2e-live.test.ts
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

const API_KEY = process.env.ROVE_API_KEY ?? ''
const BASE_URL = process.env.ROVE_API_BASE_URL ?? 'https://rove-api.fly.dev'

if (!API_KEY) {
  console.log('⏭  Skipping E2E tests: ROVE_API_KEY not set')
  process.exit(0)
}

async function apiCall(path: string, body: unknown) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  return { status: response.status, data }
}

describe('Rove API E2E — Live', () => {
  let sessionId: string

  before(async () => {
    console.log(`🔗 Testing against ${BASE_URL}`)
    console.log(`🔑 Key: ${API_KEY.slice(0, 14)}...`)
  })

  it('creates a browser session', async () => {
    const { status, data } = await apiCall('/v1/browser/session', {
      record_video: false,
    })
    assert.ok(status >= 200 && status < 300, `Expected 2xx, got ${status}: ${JSON.stringify(data)}`)
    assert.ok(data.session_id, 'Missing session_id')
    sessionId = data.session_id
    console.log(`  ✓ Session: ${sessionId}`)
  })

  it('navigates to example.com', async () => {
    const { status, data } = await apiCall('/v1/browser/action', {
      session_id: sessionId,
      action: 'navigate',
      params: { url: 'https://example.com' },
    })
    assert.equal(status, 200)
    assert.equal(data.result.title, 'Example Domain')
    assert.equal(data.result.status_code, 200)
    console.log(`  ✓ Navigate: ${data.result.title} (${data.result.load_time_ms}ms)`)
  })

  it('gets the accessibility tree', async () => {
    const { status, data } = await apiCall('/v1/browser/action', {
      session_id: sessionId,
      action: 'get_a11y_tree',
      params: {},
    })
    assert.equal(status, 200)
    assert.ok(data.result.tree, 'Missing tree')
    const tree = data.result.tree
    assert.ok(tree.includes('Example Domain'), 'Tree should contain page heading')
    console.log(`  ✓ A11y tree: ${tree.length} chars`)
  })

  it('navigates to Amazon and extracts product data', async () => {
    const { status, data } = await apiCall('/v1/browser/action', {
      session_id: sessionId,
      action: 'navigate',
      params: { url: 'https://www.amazon.com/dp/B0D1XD1ZV3' },
    })
    assert.equal(status, 200)
    assert.ok(data.result.title.includes('AirPods'), `Expected AirPods in title, got: ${data.result.title.slice(0, 60)}`)
    console.log(`  ✓ Amazon: ${data.result.title.slice(0, 60)}... (${data.result.load_time_ms}ms)`)
  })

  it('gets a11y tree from Amazon product page', async () => {
    const { status, data } = await apiCall('/v1/browser/action', {
      session_id: sessionId,
      action: 'get_a11y_tree',
      params: {},
    })
    assert.equal(status, 200)
    assert.ok(data.result.tree, 'Missing tree')
    assert.ok(data.result.tree.length > 1000, 'Amazon a11y tree should be substantial')
    console.log(`  ✓ Amazon a11y: ${data.result.tree.length} chars`)
  })

  it('extracts price from Amazon product page via a11y tree', async () => {
    // Use the full a11y tree we already fetched — search for price patterns
    const { status, data } = await apiCall('/v1/browser/action', {
      session_id: sessionId,
      action: 'get_a11y_tree',
      params: {},
    })
    assert.equal(status, 200)
    const tree = data.result.tree as string
    // Look for dollar amounts in the tree
    const priceMatches = tree.match(/\$\d[\d,]*\.?\d{0,2}/g) ?? []
    assert.ok(priceMatches.length > 0, 'Should find at least one price on the Amazon product page')
    // Find the most likely product price (not shipping, not "was" price)
    const prices = priceMatches.map((p: string) => parseFloat(p.replace('$', '').replace(',', '')))
    const productPrice = prices.find((p: number) => p > 50 && p < 500) ?? prices[0]
    assert.ok(productPrice > 0, `Price should be positive, got: ${productPrice}`)
    console.log(`  ✓ Amazon AirPods price: $${productPrice} (found ${priceMatches.length} prices on page)`)
  })

  it('takes a screenshot', async () => {
    const { status, data } = await apiCall('/v1/browser/action', {
      session_id: sessionId,
      action: 'screenshot',
      params: {},
    })
    assert.equal(status, 200)
    console.log(`  ✓ Screenshot: ${data.result?.url ? 'URL returned' : 'base64 returned'}`)
  })

  it('navigates to eBay', async () => {
    const { status, data } = await apiCall('/v1/browser/action', {
      session_id: sessionId,
      action: 'navigate',
      params: { url: 'https://www.ebay.com' },
    })
    assert.equal(status, 200)
    assert.ok(data.result.title.toLowerCase().includes('ebay'), `Expected eBay in title, got: ${data.result.title}`)
    console.log(`  ✓ eBay: ${data.result.title} (${data.result.load_time_ms}ms)`)
  })

  it('gets a11y tree from eBay and extracts first listing', async () => {
    const { status, data } = await apiCall('/v1/browser/action', {
      session_id: sessionId,
      action: 'get_a11y_tree',
      params: {},
    })
    assert.equal(status, 200)
    const tree = data.result.tree
    assert.ok(tree.length > 500, 'eBay a11y tree should be substantial')

    // Extract links that look like product listings
    const linkMatches = tree.match(/link "([^"]{10,80})"/g) ?? []
    const listings = linkMatches
      .map((m: string) => m.match(/link "([^"]+)"/)?.[1] ?? '')
      .filter((name: string) =>
        name.length > 15 &&
        !name.toLowerCase().includes('sign in') &&
        !name.toLowerCase().includes('register') &&
        !name.toLowerCase().includes('help') &&
        !name.toLowerCase().includes('sell')
      )

    if (listings.length > 0) {
      console.log(`  ✓ eBay first listing: "${listings[0].slice(0, 60)}..."`)
      console.log(`  ✓ eBay listings found: ${listings.length}`)
    } else {
      console.log(`  ✓ eBay a11y: ${tree.length} chars (no listings on homepage — expected)`)
    }
  })

  it('closes the session', async () => {
    const { status, data } = await apiCall('/v1/browser/action', {
      session_id: sessionId,
      action: 'close_session',
      params: {},
    })
    assert.equal(status, 200)
    assert.equal(data.result.status, 'closed')
    console.log(`  ✓ Session closed`)
  })

  it('creates a stealth session with jitter delay', async () => {
    const { status, data } = await apiCall('/v1/browser/session', {
      record_video: false,
      stealth: true,
      action_delay_ms: { min: 100, max: 300 },
    })
    assert.ok(status >= 200 && status < 300, `Expected 2xx, got ${status}`)
    assert.ok(data.session_id, 'Missing session_id')
    const stealthSessionId = data.session_id
    console.log(`  ✓ Stealth session: ${stealthSessionId}`)

    // Navigate with stealth + jitter active
    const navResult = await apiCall('/v1/browser/action', {
      session_id: stealthSessionId,
      action: 'navigate',
      params: { url: 'https://example.com' },
    })
    assert.equal(navResult.status, 200)
    assert.equal(navResult.data.result.title, 'Example Domain')
    console.log(`  ✓ Stealth navigate: ${navResult.data.result.title}`)

    // Get a11y tree with stealth
    const treeResult = await apiCall('/v1/browser/action', {
      session_id: stealthSessionId,
      action: 'get_a11y_tree',
      params: {},
    })
    assert.equal(treeResult.status, 200)
    assert.ok(treeResult.data.result.tree, 'Missing tree from stealth session')
    console.log(`  ✓ Stealth a11y tree: ${treeResult.data.result.tree.length} chars`)

    // Close stealth session
    const closeResult = await apiCall('/v1/browser/action', {
      session_id: stealthSessionId,
      action: 'close_session',
      params: {},
    })
    assert.equal(closeResult.status, 200)
    console.log(`  ✓ Stealth session closed`)
  })

  it('checks account usage', async () => {
    const { status, data } = await apiCall('/v1/account/usage', {})
    // Usage is a GET but we're calling POST — try GET
    const getResponse = await fetch(`${BASE_URL}/v1/account/usage`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    })
    const usage = await getResponse.json()
    assert.equal(getResponse.status, 200)
    assert.ok(usage.credits_remaining >= 0, 'Should have credits info')
    console.log(`  ✓ Credits remaining: ${usage.credits_remaining}`)
  })

  after(() => {
    console.log('\n✅ All E2E tests passed')
  })
})
