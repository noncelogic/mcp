export type McpConfig = {
  apiBaseUrl: string
  apiKey: string
}

type EnvLike = Record<string, string | undefined>

export function loadConfig(env: EnvLike): McpConfig {
  return {
    apiBaseUrl: env.ROVE_API_BASE_URL ?? 'https://api.roveapi.com',
    apiKey: env.ROVE_API_KEY ?? 'rvp_live_demo'
  }
}
