import { loadConfig, type McpConfig } from './config.js'
import { buildLlmsFullTxt, buildLlmsTxt } from './llms.js'
import { createRestClient } from './rest-client.js'
import { SessionStore } from './session-store.js'
import { TOOL_DEFS, runTool, type McpTool } from './tools.js'

export class McpScaffoldServer {
  private readonly sessions = new SessionStore()
  private readonly rest

  constructor(private readonly config: McpConfig = loadConfig((((globalThis as unknown as { process?: { env?: Record<string,string|undefined> } }).process?.env) ?? {}))) {
    this.rest = createRestClient(this.config.apiBaseUrl, this.config.apiKey)
  }

  listTools() {
    return TOOL_DEFS
  }

  async invoke(toolName: McpTool['name'], input: Record<string, unknown>, clientId = 'default') {
    return runTool(toolName, input, {
      rest: this.rest,
      sessions: this.sessions,
      clientId
    })
  }

  buildLlmsArtifacts() {
    return {
      llmsTxt: buildLlmsTxt(),
      llmsFullTxt: buildLlmsFullTxt()
    }
  }
}
