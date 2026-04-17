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
      },
    },
    mappedEndpoint: 'POST /v1/browser/action (screenshot) or POST /v1/browser/screenshot'
  },
  {
    name: 'get_a11y_tree',
    description: 'Get the accessibility tree snapshot of the current page in the browser session. Returns a structured representation of all interactive elements, text content, and ARIA attributes — the core differentiator of Rove. Uses ~26K tokens vs ~114K for a screenshot (77% reduction).',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'The browser session ID. The session must have navigated to a page first.' },
      },
      required: ['session_id'],
    },
    mappedEndpoint: 'POST /v1/browser/action (get_a11y_tree)'
  },
  {
    name: 'click',
    description: 'Click an element on the page by CSS selector. Use this to interact with buttons, links, checkboxes, and other clickable elements.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'The browser session ID.' },
        selector: { type: 'string', description: 'CSS selector of the element to click (e.g. "button.submit", "#login", "a[href=\'/pricing\']").' },
      },
      required: ['session_id', 'selector'],
    },
    mappedEndpoint: 'POST /v1/browser/action (click)'
  },
  {
    name: 'fill',
    description: 'Type text into a form field. Clears any existing value first, then types the new value.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'The browser session ID.' },
        selector: { type: 'string', description: 'CSS selector of the input element (e.g. "input[name=email]", "#search-box").' },
        value: { type: 'string', description: 'The text to type into the field.' },
      },
      required: ['session_id', 'selector', 'value'],
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
      },
      required: ['session_id', 'selector'],
    },
    mappedEndpoint: 'POST /v1/browser/action (get_text)'
  },
  {
    name: 'scroll',
    description: 'Scroll the page in a given direction. Useful for loading lazy content or reaching elements below the fold.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'The browser session ID.' },
        direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], description: 'Scroll direction.' },
        amount: { type: 'number', description: 'Pixels to scroll. Default: 500.' },
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
        script: { type: 'string', description: 'JavaScript code to execute in the page context. The return value is serialized as JSON.' },
      },
      required: ['session_id', 'script'],
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

      const result = await rest.runAction({ session_id: sessionId, action: 'navigate', params: { url } })
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
        const result = await rest.runAction({ session_id: sessionId, action: 'screenshot', params: {} })
        return { session_id: sessionId, ...result }
      }

      const url = input.url
      if (typeof url !== 'string' || !url) throw new Error('url is required for standalone screenshot')
      return rest.standaloneScreenshot({ url })
    }

    case 'get_a11y_tree': {
      const sessionId = resolveSessionId(input, sessions, clientId)
      const result = await rest.runAction({ session_id: sessionId, action: 'get_a11y_tree', params: {} })
      return { session_id: sessionId, ...result }
    }

    case 'click': {
      const sessionId = resolveSessionId(input, sessions, clientId)
      const selector = input.selector
      if (typeof selector !== 'string' || !selector) throw new Error('selector is required')
      const result = await rest.runAction({ session_id: sessionId, action: 'click', params: { selector } })
      return { session_id: sessionId, ...result }
    }

    case 'fill': {
      const sessionId = resolveSessionId(input, sessions, clientId)
      const selector = input.selector
      const value = input.value
      if (typeof selector !== 'string' || !selector) throw new Error('selector is required')
      if (typeof value !== 'string') throw new Error('value is required')
      const result = await rest.runAction({ session_id: sessionId, action: 'fill', params: { selector, value } })
      return { session_id: sessionId, ...result }
    }

    case 'get_text': {
      const sessionId = resolveSessionId(input, sessions, clientId)
      const selector = input.selector
      if (typeof selector !== 'string' || !selector) throw new Error('selector is required')
      const result = await rest.runAction({ session_id: sessionId, action: 'get_text', params: { selector } })
      return { session_id: sessionId, ...result }
    }

    case 'scroll': {
      const sessionId = resolveSessionId(input, sessions, clientId)
      const direction = input.direction
      if (typeof direction !== 'string') throw new Error('direction is required')
      const result = await rest.runAction({ session_id: sessionId, action: 'scroll', params: { direction, amount: input.amount ?? 500 } })
      return { session_id: sessionId, ...result }
    }

    case 'evaluate': {
      const sessionId = resolveSessionId(input, sessions, clientId)
      const script = input.script
      if (typeof script !== 'string' || !script) throw new Error('script is required')
      const result = await rest.runAction({ session_id: sessionId, action: 'evaluate', params: { script } })
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

        if (pollData.status === 'expired' || pollData.status === 'rejected') {
          throw new Error(`Authentication ${pollData.status}. Please try again.`)
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
