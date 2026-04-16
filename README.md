# @roveapi/mcp

MCP server for [Rove](https://roveapi.com) — a hosted Playwright API for AI agents.

Returns **accessibility trees** instead of screenshots, reducing LLM token consumption by ~77% (26K tokens vs 114K for a typical page).

## Quick Start

```bash
npx -y @roveapi/mcp
```

Set your API key via environment variable:

```bash
ROVE_API_KEY=rvp_live_... npx -y @roveapi/mcp
```

## Install in Claude Code

```bash
claude mcp add --scope user rove -e ROVE_API_KEY=rvp_live_YOUR_KEY -- npx -y @roveapi/mcp
```

## Install in Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rove": {
      "command": "npx",
      "args": ["-y", "@roveapi/mcp"],
      "env": {
        "ROVE_API_KEY": "rvp_live_YOUR_KEY"
      }
    }
  }
}
```

## Install in Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "rove": {
      "command": "npx",
      "args": ["-y", "@roveapi/mcp"],
      "env": {
        "ROVE_API_KEY": "rvp_live_YOUR_KEY"
      }
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `navigate` | Navigate to a URL. Auto-creates a session. Supports stealth mode and action jitter. |
| `interact` | Click or fill actions in the active session. |
| `extract_schema` | Extract structured data from a URL using a JSON schema. |
| `screenshot` | Take a screenshot (in-session or standalone). |
| `get_a11y_tree` | Get the accessibility tree snapshot — the core differentiator. |
| `close_session` | Close a browser session and release resources. |

## Why Accessibility Trees?

Traditional browser automation returns screenshots that cost ~114K tokens per page. Rove returns structured accessibility trees at ~26K tokens — **77% fewer tokens**, faster responses, and better structured data for LLMs to reason over.

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `ROVE_API_KEY` | `rvp_live_demo` | Your Rove API key |
| `ROVE_API_BASE_URL` | `https://api.roveapi.com` | API endpoint |

## Get an API Key

Sign up at [roveapi.com](https://roveapi.com) — 100 free credits on signup, no card required.

## License

MIT
