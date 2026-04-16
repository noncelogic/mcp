import type { RestClient } from './rest-client.js'
import type { SessionStore } from './session-store.js'

export type McpTool = {
  name: 'navigate' | 'interact' | 'extract_schema' | 'screenshot' | 'get_a11y_tree' | 'close_session'
  description: string
  inputSchema: Record<string, unknown>
  mappedEndpoint: string
}

export const TOOL_DEFS: McpTool[] = [
  {
    name: 'navigate',
    description: 'Navigate to a URL. Creates a session automatically if none exists. Use stealth: true when visiting public sites to reduce bot detection. Use action_delay_ms to add polite jitter between actions.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full URL to navigate to' },
        session_id: { type: 'string', description: 'Reuse an existing session' },
        stealth: { type: 'boolean', description: 'Enable stealth mode: realistic user agent, hidden webdriver flag. Default: false' },
        action_delay_ms: {
          type: 'object',
          description: 'Random delay between actions (ms). E.g. {"min": 500, "max": 1500}',
          properties: { min: { type: 'number' }, max: { type: 'number' } },
        },
      },
      required: ['url'],
    },
    mappedEndpoint: 'POST /v1/browser/action (navigate)'
  },
  {
    name: 'interact',
    description: 'Perform click/fill style actions in active session.',
    inputSchema: {
      type: 'object',
      properties: { session_id: { type: 'string' }, action: { type: 'string', enum: ['click', 'fill'] }, params: { type: 'object' } },
      required: ['session_id', 'action']
    },
    mappedEndpoint: 'POST /v1/browser/action (click/fill)'
  },
  {
    name: 'extract_schema',
    description: 'Reserved mapping for extraction path.',
    inputSchema: { type: 'object', properties: { url: { type: 'string' }, schema: { type: 'object' } }, required: ['url', 'schema'] },
    mappedEndpoint: 'POST /v1/browser/extract'
  },
  {
    name: 'screenshot',
    description: 'Take in-session or standalone screenshot. Explicit session_id is persisted as active session context.',
    inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, url: { type: 'string' } } },
    mappedEndpoint: 'POST /v1/browser/action (screenshot) or POST /v1/browser/screenshot'
  },
  {
    name: 'get_a11y_tree',
    description: 'Get accessibility tree snapshot for active session.',
    inputSchema: { type: 'object', properties: { session_id: { type: 'string' } }, required: ['session_id'] },
    mappedEndpoint: 'POST /v1/browser/action (get_a11y_tree)'
  },
  {
    name: 'close_session',
    description: 'Close current session and clear MCP state only when closing the currently stored session.',
    inputSchema: { type: 'object', properties: { session_id: { type: 'string' } }, required: ['session_id'] },
    mappedEndpoint: 'POST /v1/browser/action (close_session)'
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

    case 'close_session': {
      const explicit = input.session_id
      const sessionId = typeof explicit === 'string' && explicit.length > 0 ? explicit : resolveSessionId(input, sessions, clientId)
      const result = await rest.runAction({ session_id: sessionId, action: 'close_session', params: {} })

      const currentlyStored = sessions.get(clientId)
      const cleared = currentlyStored === sessionId
      if (cleared) sessions.clear(clientId)

      return { session_id: sessionId, ...result, cleanup: { session_store_cleared: cleared } }
    }
  }
}
