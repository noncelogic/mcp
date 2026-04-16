import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLlmsFullTxt, buildLlmsTxt } from '../src/llms'
import { SessionStore } from '../src/session-store'
import { TOOL_DEFS, runTool } from '../src/tools'

test('tool surface includes required v1 scaffold', () => {
  const names = TOOL_DEFS.map((t) => t.name)
  for (const expected of ['navigate', 'interact', 'extract_schema', 'screenshot', 'get_a11y_tree', 'close_session']) {
    assert.ok(names.includes(expected as any))
  }
})

test('explicit mapping exists for each tool', () => {
  for (const tool of TOOL_DEFS) {
    assert.equal(typeof tool.mappedEndpoint, 'string')
    assert.ok(tool.mappedEndpoint.length > 10)
  }
})

test('stateful flow persists explicit session_id for follow-up tool call', async () => {
  const sessions = new SessionStore()
  const calls: Array<{ session_id: string; action: string }> = []

  const rest = {
    createSession: async () => ({ session_id: 'sess_new', connection_token: 'ct', expires_at: new Date().toISOString() }),
    runAction: async (input: { session_id: string; action: string }) => {
      calls.push(input)
      return { success: true, result: { ok: true } }
    },
    standaloneScreenshot: async () => ({ url: 'https://x', expires_at: new Date().toISOString() }),
    getArtifacts: async () => ({ session_id: 's', artifacts: [] })
  }

  await runTool('navigate', { url: 'https://example.com', session_id: 'sess_explicit' }, { rest, sessions, clientId: 'client-a' })
  await runTool('get_a11y_tree', {}, { rest, sessions, clientId: 'client-a' })

  assert.equal(calls[0]?.session_id, 'sess_explicit')
  assert.equal(calls[1]?.session_id, 'sess_explicit')
})

test('close_session only clears when closing currently stored session', async () => {
  const sessions = new SessionStore()
  sessions.set('client-a', 'sess_active')

  const rest = {
    createSession: async () => ({ session_id: 'sess_new', connection_token: 'ct', expires_at: new Date().toISOString() }),
    runAction: async () => ({ success: true, result: { status: 'closed' } }),
    standaloneScreenshot: async () => ({ url: 'https://x', expires_at: new Date().toISOString() }),
    getArtifacts: async () => ({ session_id: 's', artifacts: [] })
  }

  const wrongClose = await runTool('close_session', { session_id: 'sess_other' }, { rest, sessions, clientId: 'client-a' })
  assert.equal((wrongClose as { cleanup: { session_store_cleared: boolean } }).cleanup.session_store_cleared, false)
  assert.equal(sessions.get('client-a'), 'sess_active')

  sessions.set('client-a', 'sess_active')
  const rightClose = await runTool('close_session', { session_id: 'sess_active' }, { rest, sessions, clientId: 'client-a' })
  assert.equal((rightClose as { cleanup: { session_store_cleared: boolean } }).cleanup.session_store_cleared, true)
  assert.equal(sessions.get('client-a'), undefined)
})

test('llms hooks generate non-empty outputs', () => {
  const llms = buildLlmsTxt()
  const full = buildLlmsFullTxt()
  assert.ok(llms.includes('Rove MCP Server'))
  assert.ok(full.includes('cleanupBehavior'))
})
