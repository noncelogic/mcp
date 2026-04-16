export type CreateSessionResponse = {
  session_id: string
  connection_token: string
  expires_at: string
}

export type ActionEnvelope = {
  success: boolean
  result: Record<string, unknown>
  duration_ms?: number
}

export type StandaloneScreenshotResponse = {
  url: string
  expires_at: string
  width_px?: number
  height_px?: number
  source_url?: string
  artifact_id?: string
}

export type ArtifactsResponse = {
  session_id: string
  artifacts: Array<{
    type: string
    url: string
    expires_at: string
    width_px?: number
    height_px?: number
  }>
}

export type ExtractResponse = {
  data: Record<string, unknown>
}

export type RestClient = {
  createSession(input?: Record<string, unknown>): Promise<CreateSessionResponse>
  runAction(input: { session_id: string; action: string; params?: Record<string, unknown> }): Promise<ActionEnvelope>
  standaloneScreenshot(input: { url: string }): Promise<StandaloneScreenshotResponse>
  extract(input: { url: string; schema: Record<string, string>; wait_for_selector?: string }): Promise<ExtractResponse>
  getArtifacts(sessionId: string): Promise<ArtifactsResponse>
}

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

export function createRestClient(apiBaseUrl: string, apiKey: string): RestClient {
  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        ...(init?.headers ?? {})
      }
    })

    const body = await parseJson<Record<string, unknown>>(response).catch(() => ({}))
    if (!response.ok) {
      throw new Error(`API ${path} failed (${response.status}): ${JSON.stringify(body)}`)
    }

    return body as T
  }

  return {
    createSession: (input) => call<CreateSessionResponse>('/v1/browser/session', { method: 'POST', body: JSON.stringify(input ?? {}) }),
    runAction: (input) => call<ActionEnvelope>('/v1/browser/action', { method: 'POST', body: JSON.stringify(input) }),
    standaloneScreenshot: (input) =>
      call<StandaloneScreenshotResponse>('/v1/browser/screenshot', { method: 'POST', body: JSON.stringify(input) }),
    extract: (input) =>
      call<ExtractResponse>('/v1/browser/extract', { method: 'POST', body: JSON.stringify(input) }),
    getArtifacts: (sessionId) => call<ArtifactsResponse>(`/v1/browser/artifacts/${sessionId}`, { method: 'GET' })
  }
}
