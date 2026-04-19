import { BrowserClient } from '@roveapi/browser'

export type ActionEnvelope = {
  success: boolean
  result: Record<string, unknown>
  duration_ms?: number
}

export type RestClient = {
  readonly baseUrl: string
  readonly apiKey: string
  readonly browser: BrowserClient
  createSession(input?: Record<string, unknown>): Promise<{ session_id: string }>
  runAction(input: { session_id: string; action: string; params?: Record<string, unknown> }): Promise<ActionEnvelope>
  standaloneScreenshot(input: { url: string }): Promise<Record<string, unknown>>
  extract(input: { url: string; schema: Record<string, string>; wait_for_selector?: string }): Promise<{ data: Record<string, unknown> }>
  getArtifacts(sessionId: string): Promise<{ session_id: string; artifacts: Array<Record<string, unknown>> }>
}

export function createRestClient(apiBaseUrl: string, apiKey: string): RestClient {
  const browser = new BrowserClient({ apiKey, baseUrl: apiBaseUrl })

  return {
    baseUrl: apiBaseUrl,
    apiKey,
    browser,
    createSession: (input) =>
      browser.request('/v1/browser/session', { method: 'POST', body: input ?? {} }),
    runAction: (input) =>
      browser.request('/v1/browser/action', { method: 'POST', body: input }),
    standaloneScreenshot: (input) =>
      browser.request('/v1/browser/screenshot', { method: 'POST', body: input }),
    extract: (input) =>
      browser.request('/v1/browser/extract', { method: 'POST', body: input }),
    getArtifacts: (sessionId) =>
      browser.request(`/v1/browser/artifacts/${sessionId}`, { method: 'GET' }),
  }
}
