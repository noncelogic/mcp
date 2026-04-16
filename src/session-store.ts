export class SessionStore {
  private readonly sessions = new Map<string, string>()

  get(clientId: string): string | undefined {
    return this.sessions.get(clientId)
  }

  set(clientId: string, sessionId: string) {
    this.sessions.set(clientId, sessionId)
  }

  clear(clientId: string) {
    this.sessions.delete(clientId)
  }
}
