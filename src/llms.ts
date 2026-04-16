import { TOOL_DEFS } from './tools.js'

export function buildLlmsTxt(): string {
  const lines = [
    '# Rove MCP Server',
    '',
    '## Tools',
    ...TOOL_DEFS.map((t) => `- ${t.name}: ${t.description}`),
    '',
    '## Mapping',
    ...TOOL_DEFS.map((t) => `- ${t.name} -> ${t.mappedEndpoint}`)
  ]
  return lines.join('\n')
}

export function buildLlmsFullTxt(): string {
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      tools: TOOL_DEFS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        mappedEndpoint: t.mappedEndpoint
      })),
      cleanupBehavior: {
        close_session: 'Invokes REST close_session and clears MCP session store entry.'
      }
    },
    null,
    2
  )
}
