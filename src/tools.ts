import type { RestClient } from './rest-client.js'
import type { SessionStore } from './session-store.js'

export type McpTool = {
  name: 'navigate' | 'interact' | 'extract_schema' | 'screenshot' | 'get_a11y_tree' | 'close_session' | 'click' | 'fill' | 'get_text' | 'scroll' | 'evaluate' | 'list_sessions' | 'authenticate' | 'account_info' | 'buy_credits'
  description: string
  inputSchema: Record<string, unknown>
  mappedEndpoint: string
}

export const TOOL_DEFS: McpTool[] = [
  {
    name: 'navigate',
    description: 'Navigate a browser to a URL and return the page title, final URL, and accessibility tree snapshot. Automatically creates a new browser session if none exists. Returns structured data ideal for LLM consumption — 77% fewer tokens than screenshots.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full URL to navigate to (e.g. "https://example.com")' },
        session_id: { type: 'string', description: 'Reuse an existing browser session. If omitted, a new session is created automatically.' },
        wait_until: { type: 'string', enum: ['load', 'domcontentloaded', 'networkidle'], description: 'Page lifecycle event to wait for. Default: "networkidle".' },
        timeout_ms: { type: 'number', description: 'Navigation timeout in milliseconds. Default: 30000.' },
        stealth: { type: 'boolean', description: 'Enable stealth mode: sets a realistic user agent and hides the webdriver flag to reduce bot detection on public sites. Default: false.' },
        action_delay_ms: {
          type: 'object',
          description: 'Add random delay between browser actions for polite scraping. Specify min and max milliseconds, e.g. {"min": 500, "max": 1500}.',
          properties: {
            min: { type: 'number', description: 'Minimum delay in milliseconds' },
            max: { type: 'number', description: 'Maximum delay in milliseconds' },
          },
        },
      },
      required: ['url'],
    },
    mappedEndpoint: 'POST /v1/browser/action (navigate)'
  },
  {
    name: 'interact',
    description: 'Perform a click or fill action on an element in the current browser session. Use "click" to click a button or link by CSS selector, or "fill" to type text into an input field.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'The browser session ID returned by navigate.' },
        action: { type: 'string', enum: ['click', 'fill'], description: 'The interaction type: "click" to click an element, "fill" to type into an input.' },
        params: {
          type: 'object',
          description: 'Action parameters. For click: {"selector": "button.submit"}. For fill: {"selector": "input[name=email]", "value": "user@example.com"}.',
        },
      },
      required: ['session_id', 'action']
    },
    mappedEndpoint: 'POST /v1/browser/action (click/fill)'
  },
  {
    name: 'extract_schema',
    description: 'Extract structured data from a webpage using a JSON schema. Navigates to the URL, waits for the page to load, and extracts values matching the schema keys from the page content. Returns a JSON object with the extracted data.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL of the page to extract data from (e.g. "https://example.com/product")' },
        schema: {
          type: 'object',
          description: 'A JSON object where keys are the field names to extract and values describe the expected data type. Example: {"price": "string", "title": "string", "rating": "number"}.',
        },
        wait_for_selector: { type: 'string', description: 'Optional CSS selector to wait for before extracting data, useful for dynamically loaded content.' },
      },
      required: ['url', 'schema'],
    },
    mappedEndpoint: 'POST /v1/browser/extract'
  },
  {
    name: 'screenshot',
    description: 'Capture a screenshot of the current browser page. Can take an in-session screenshot (using session_id) or a standalone screenshot of any URL. Returns the screenshot URL and metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Browser session ID for in-session screenshot. If provided, captures the current page state.' },
        url: { type: 'string', description: 'URL to screenshot. Used for standalone screenshots when no session_id is provided.' },
        selector: { type: 'string', description: 'CSS selector to screenshot a specific element instead of the page. In-session mode only.' },
        full_page: { type: 'boolean', description: 'Capture the full scrollable page, not just the viewport. In-session mode only. Default: false.' },
        format: { type: 'string', enum: ['png', 'jpeg'], description: 'Image format. In-session mode only. Default: "png".' },
      },
    },
    mappedEndpoint: 'POST /v1/browser/action (screenshot) or POST /v1/browser/screenshot'
  },
  {
    name: 'get_a11y_tree',
    description: 'Get the accessibility tree snapshot of the current page. Returns structured data 77% smaller than a screenshot. Auto-scopes to the main content area on large pages (50K+ chars). Use selector to manually scope to a specific element.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'The browser session ID. The session must have navigated to a page first.' },
        selector: { type: 'string', description: 'CSS selector to scope the tree to a specific element (e.g. "#search-results", "main"). If omitted on large pages, auto-scopes to the main landmark.' },
        max_chars: { type: 'number', description: 'Maximum characters to return. Truncates at nearest line boundary.' },
        max_depth: { type: 'number', description: 'Maximum tree depth. Limits nesting to get a structural overview without deep details.' },
        visible_only: { type: 'boolean', description: 'Only include visible elements. Skips hidden menus, modals, and offscreen content.' },
        exclude_selectors: { type: 'array', items: { type: 'string' }, description: 'CSS selectors to exclude from the tree (e.g. ["nav", "footer", ".ad-slot"]). Elements are hidden before snapshotting.' },
      },
      required: ['session_id'],
    },
    mappedEndpoint: 'POST /v1/browser/action (get_a11y_tree)'
  },
  {
    name: 'click',
    description: 'Click an element on the page by CSS selector or accessible label. Use this to interact with buttons, links, checkboxes, and other clickable elements.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'The browser session ID.' },
        selector: { type: 'string', description: 'CSS selector of the element to click (e.g. "button.submit", "#login", "a[href=\'/pricing\']"). Either selector or label is required.' },
        label: { type: 'string', description: 'Accessible name or visible text to click by (e.g. "Sign in", "Submit"). Alternative to selector; matches buttons, links, labels, and text.' },
        button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Mouse button to click with. Default: "left".' },
        click_count: { type: 'number', description: 'Number of clicks (e.g. 2 for double-click). Default: 1.' },
        wait_after_ms: { type: 'number', description: 'Milliseconds to wait after clicking before returning. Useful for pages that update asynchronously.' },
      },
      required: ['session_id'],
    },
    mappedEndpoint: 'POST /v1/browser/action (click)'
  },
  {
    name: 'fill',
    description: 'Type text into a form field. By default clears any existing value first, then types the new value.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'The browser session ID.' },
        selector: { type: 'string', description: 'CSS selector of the input element (e.g. "input[name=email]", "#search-box"). Either selector or label is required.' },
        label: { type: 'string', description: 'Accessible label of the input (e.g. "Email address"). Alternative to selector.' },
        value: { type: 'string', description: 'The text to type into the field.' },
        clear_first: { type: 'boolean', description: 'Clear the existing value before typing. Default: true.' },
      },
      required: ['session_id', 'value'],
    },
    mappedEndpoint: 'POST /v1/browser/action (fill)'
  },
  {
    name: 'get_text',
    description: 'Extract the text content of an element on the page. Useful for reading specific values like prices, headings, or status messages.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'The browser session ID.' },
        selector: { type: 'string', description: 'CSS selector of the element to read text from.' },
        trim: { type: 'boolean', description: 'Trim leading/trailing whitespace from the extracted text. Default: true.' },
      },
      required: ['session_id', 'selector'],
    },
    mappedEndpoint: 'POST /v1/browser/action (get_text)'
  },
  {
    name: 'scroll',
    description: 'Scroll the page in a given direction, or scroll a specific scrollable element. Useful for loading lazy content or reaching elements below the fold.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'The browser session ID.' },
        direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], description: 'Scroll direction.' },
        amount: { type: 'number', description: 'Pixels to scroll. Default: 500.' },
        selector: { type: 'string', description: 'CSS selector of a scrollable element. If omitted, the window is scrolled.' },
      },
      required: ['session_id', 'direction'],
    },
    mappedEndpoint: 'POST /v1/browser/action (scroll)'
  },
  {
    name: 'evaluate',
    description: 'Execute arbitrary JavaScript in the browser page context. Returns the result of the expression. Use for advanced DOM queries, custom extraction logic, or page manipulation.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'The browser session ID.' },
        expression: { type: 'string', description: 'JavaScript expression to evaluate in the page context. The return value is serialized as JSON.' },
      },
      required: ['session_id', 'expression'],
    },
    mappedEndpoint: 'POST /v1/browser/action (evaluate)'
  },
  {
    name: 'list_sessions',
    description: 'Show the current active browser session for this MCP connection, including its URL, page title, and expiry.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    mappedEndpoint: 'GET (local state)'
  },
  {
    name: 'close_session',
    description: 'Close a browser session and release all associated resources (browser context, page, video recording). Returns a list of artifacts (screenshots, videos) captured during the session.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'The browser session ID to close.' },
      },
      required: ['session_id'],
    },
    mappedEndpoint: 'POST /v1/browser/action (close_session)'
  },
  {
    name: 'authenticate',
    description: 'Authenticate this MCP session by email. Sends a magic link to your inbox — click it to activate your session and get an API key. Required before using browser tools if no ROVE_API_KEY is set.',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Your email address to receive the magic link.' },
      },
      required: ['email'],
    },
    mappedEndpoint: 'POST /api/public/auth/device/start'
  },
  {
    name: 'account_info',
    description: 'Check your Rove account status including credit balance, plan tier, and API key info.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    mappedEndpoint: 'GET /v1/account/usage'
  },
  {
    name: 'buy_credits',
    description: 'Get pricing information and purchase links for Rove credits. Returns Founder Pack tiers and top-up bundles with direct links to the pricing page.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    mappedEndpoint: 'GET /pricing'
  }
]

function resolveSessionId(input: Record<string, unknown>, sessionStore: SessionStore, clientId: string): string {
  const explicit = input.session_id
  if (typeof explicit === 'string' && explicit.length > 0) {
    sessionStore.set(clientId, explicit)
    return explicit
  }
  const fromStore = sessionStore.get(clientId)
  if (!fromStore) throw new Error('session_id required and no active session in store')
  return fromStore
}

export async function runTool(
  toolName: McpTool['name'],
  input: Record<string, unknown>,
  deps: { rest: RestClient; sessions: SessionStore; clientId: string }
) {
  const { rest, sessions, clientId } = deps

  switch (toolName) {
    case 'navigate': {
      const url = input.url
      if (typeof url !== 'string' || !url) throw new Error('url is required')

      let sessionId = typeof input.session_id === 'string' ? input.session_id : sessions.get(clientId)
      if (!sessionId) {
        const sessionOpts: Record<string, unknown> = {}
        if (input.stealth === true) sessionOpts.stealth = true
        if (input.action_delay_ms && typeof input.action_delay_ms === 'object') {
          sessionOpts.action_delay_ms = input.action_delay_ms
        }
        const created = await rest.createSession(sessionOpts)
        sessionId = created.session_id
      }
      sessions.set(clientId, sessionId)

      const params: Record<string, unknown> = { url }
      if (typeof input.wait_until === 'string') params.wait_until = input.wait_until
      if (typeof input.timeout_ms === 'number') params.timeout_ms = input.timeout_ms

      const result = await rest.runAction({ session_id: sessionId, action: 'navigate', params })
      return { session_id: sessionId, ...result }
    }

    case 'interact': {
      const action = input.action
      if (action !== 'click' && action !== 'fill') throw new Error('action must be click|fill')
      const sessionId = resolveSessionId(input, sessions, clientId)
      const result = await rest.runAction({
        session_id: sessionId,
        action,
        params: (input.params as Record<string, unknown> | undefined) ?? {}
      })
      return { session_id: sessionId, ...result }
    }

    case 'extract_schema': {
      const url = input.url
      if (typeof url !== 'string' || !url) throw new Error('url is required')
      const schema = input.schema
      if (!schema || typeof schema !== 'object') throw new Error('schema is required')
      return rest.extract({
        url,
        schema: schema as Record<string, string>,
        wait_for_selector: input.wait_for_selector as string | undefined,
      })
    }

    case 'screenshot': {
      const explicit = typeof input.session_id === 'string' ? input.session_id : undefined
      const stored = sessions.get(clientId)
      const sessionId = explicit ?? stored

      if (sessionId) {
        sessions.set(clientId, sessionId)
        const params: Record<string, unknown> = {}
        if (typeof input.selector === 'string') params.selector = input.selector
        if (typeof input.full_page === 'boolean') params.full_page = input.full_page
        if (typeof input.format === 'string') params.format = input.format
        const result = await rest.runAction({ session_id: sessionId, action: 'screenshot', params })
        return { session_id: sessionId, ...result }
      }

      const url = input.url
      if (typeof url !== 'string' || !url) throw new Error('url is required for standalone screenshot')
      return rest.standaloneScreenshot({ url })
    }

    case 'get_a11y_tree': {
      const sessionId = resolveSessionId(input, sessions, clientId)
      const params: Record<string, unknown> = {}
      if (input.selector) params.selector = input.selector
      if (input.max_chars) params.max_chars = input.max_chars
      if (input.max_depth) params.max_depth = input.max_depth
      if (input.visible_only) params.visible_only = input.visible_only
      if (input.exclude_selectors) params.exclude_selectors = input.exclude_selectors
      const result = await rest.runAction({ session_id: sessionId, action: 'get_a11y_tree', params })
      return { session_id: sessionId, ...result }
    }

    case 'click': {
      const sessionId = resolveSessionId(input, sessions, clientId)
      const selector = typeof input.selector === 'string' ? input.selector : undefined
      const label = typeof input.label === 'string' ? input.label : undefined
      if (!selector && !label) throw new Error('selector or label is required')

      const params: Record<string, unknown> = {}
      if (selector) params.selector = selector
      if (label) params.label = label
      if (typeof input.button === 'string') params.button = input.button
      if (typeof input.click_count === 'number') params.click_count = input.click_count
      if (typeof input.wait_after_ms === 'number') params.wait_after_ms = input.wait_after_ms

      const result = await rest.runAction({ session_id: sessionId, action: 'click', params })
      return { session_id: sessionId, ...result }
    }

    case 'fill': {
      const sessionId = resolveSessionId(input, sessions, clientId)
      const selector = typeof input.selector === 'string' ? input.selector : undefined
      const label = typeof input.label === 'string' ? input.label : undefined
      const value = input.value
      if (!selector && !label) throw new Error('selector or label is required')
      if (typeof value !== 'string') throw new Error('value is required')

      const params: Record<string, unknown> = { value }
      if (selector) params.selector = selector
      if (label) params.label = label
      if (typeof input.clear_first === 'boolean') params.clear_first = input.clear_first

      const result = await rest.runAction({ session_id: sessionId, action: 'fill', params })
      return { session_id: sessionId, ...result }
    }

    case 'get_text': {
      const sessionId = resolveSessionId(input, sessions, clientId)
      const selector = input.selector
      if (typeof selector !== 'string' || !selector) throw new Error('selector is required')

      const params: Record<string, unknown> = { selector }
      if (typeof input.trim === 'boolean') params.trim = input.trim

      const result = await rest.runAction({ session_id: sessionId, action: 'get_text', params })
      return { session_id: sessionId, ...result }
    }

    case 'scroll': {
      const sessionId = resolveSessionId(input, sessions, clientId)
      const direction = input.direction
      if (typeof direction !== 'string') throw new Error('direction is required')

      const params: Record<string, unknown> = { direction, amount: input.amount ?? 500 }
      if (typeof input.selector === 'string') params.selector = input.selector

      const result = await rest.runAction({ session_id: sessionId, action: 'scroll', params })
      return { session_id: sessionId, ...result }
    }

    case 'evaluate': {
      const sessionId = resolveSessionId(input, sessions, clientId)
      const expression = input.expression
      if (typeof expression !== 'string' || !expression) throw new Error('expression is required')
      const result = await rest.runAction({ session_id: sessionId, action: 'evaluate', params: { expression } })
      return { session_id: sessionId, ...result }
    }

    case 'list_sessions': {
      const activeSessionId = sessions.get(clientId)
      return { active_session_id: activeSessionId ?? null }
    }

    case 'close_session': {
      const explicit = input.session_id
      const sessionId = typeof explicit === 'string' && explicit.length > 0 ? explicit : resolveSessionId(input, sessions, clientId)
      const result = await rest.runAction({ session_id: sessionId, action: 'close_session', params: {} })

      const currentlyStored = sessions.get(clientId)
      const cleared = currentlyStored === sessionId
      if (cleared) sessions.clear(clientId)

      return { session_id: sessionId, ...result, cleanup: { session_store_cleared: cleared } }
    }

    case 'authenticate': {
      const email = input.email
      if (typeof email !== 'string' || !email.includes('@')) throw new Error('A valid email address is required.')

      const startResponse = await fetch(`${rest.baseUrl}/api/public/auth/device/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!startResponse.ok) {
        const err = await startResponse.text()
        throw new Error(`Failed to start authentication: ${err}`)
      }

      const { request_code } = await startResponse.json() as { request_code: string }

      // Poll for approval (user clicks magic link in email)
      const pollInterval = 3000
      const maxAttempts = 60 // 3 minutes
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))

        const pollResponse = await fetch(`${rest.baseUrl}/api/public/auth/device/poll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ request_code }),
        })

        if (!pollResponse.ok) continue

        const pollData = await pollResponse.json() as { status: string; api_key?: string }

        if (pollData.status === 'approved' && pollData.api_key) {
          return {
            authenticated: true,
            api_key: pollData.api_key,
            message: `Authenticated as ${email}. To persist this key, restart the MCP server with ROVE_API_KEY=${pollData.api_key} in your environment.`,
          }
        }

        if (pollData.status === 'expired') {
          throw new Error('Authentication expired. Please try again.')
        }
      }

      return {
        authenticated: false,
        message: `Magic link sent to ${email} but timed out waiting for approval. Check your inbox and click the link, then try again.`,
      }
    }

    case 'account_info': {
      const response = await fetch(`${rest.baseUrl}/v1/account/usage`, {
        headers: { 'Authorization': `Bearer ${rest.apiKey}` },
      })
      if (!response.ok) throw new Error(`Failed to fetch account info (${response.status})`)
      const data = await response.json()
      return { ...data as Record<string, unknown>, buy_credits: 'Use the buy_credits tool to see pricing and purchase links.' }
    }

    case 'buy_credits': {
      return {
        pricing: 'https://roveapi.com/pricing',
        packs: [
          { name: 'Solo', price: '$99', credits: '5,000' },
          { name: 'Builder', price: '$199', credits: '10,000', best_value: true },
          { name: 'Agency', price: '$349', credits: '25,000' },
        ],
        top_ups: [
          { credits: '1,000', price: '$12' },
          { credits: '5,000', price: '$49' },
          { credits: '10,000', price: '$89' },
        ],
        note: 'Visit roveapi.com/pricing to purchase. Credits never expire. 1 credit = 1 action.',
      }
    }
  }
}
