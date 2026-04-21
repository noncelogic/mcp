#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { loadConfig } from './config.js'
import { createRestClient } from './rest-client.js'
import { SessionStore } from './session-store.js'
import { TOOL_DEFS, runTool } from './tools.js'

const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
) as { version: string }

function createMcpServer(env: Record<string, string | undefined> = {}) {
  const config = loadConfig(env)
  const rest = createRestClient(config.apiBaseUrl, config.apiKey)
  const sessions = new SessionStore()

  const server = new Server(
    { name: 'rove-browser', version: pkg.version },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    try {
      const result = await runTool(
        name as (typeof TOOL_DEFS)[number]['name'],
        (args ?? {}) as Record<string, unknown>,
        { rest, sessions, clientId: 'mcp' },
      )
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      }
    }
  })

  return server
}

/** Smithery sandbox — returns a server instance with safe defaults for capability scanning */
export function createSandboxServer() {
  return createMcpServer({
    ROVE_API_KEY: 'rvp_test_sandbox',
    ROVE_API_BASE_URL: 'https://api.roveapi.com',
  })
}

export default createSandboxServer

async function main() {
  const server = createMcpServer(process.env)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

// Only auto-start when run directly (not when imported by Smithery scanner)
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('/index.js') ||
  process.argv[1].endsWith('/index.ts') ||
  process.argv[1].includes('rove-mcp')
)
if (isDirectRun) {
  main().catch((err) => {
    console.error('MCP server failed to start:', err)
    process.exit(1)
  })
}
