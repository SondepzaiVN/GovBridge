import path from 'node:path';
import { JsonFileStore } from '../../storage/json-file-store.js';
import type { AssistantSession, AssistantSessionStore } from './assistant.types.js';

export class AssistantSessionRepository {
  private readonly store: JsonFileStore<AssistantSessionStore>;

  constructor(dataDirectory: string) {
    this.store = new JsonFileStore(path.join(dataDirectory, 'assistant-sessions.json'), { schemaVersion: 1, sessions: [] });
  }

  async findById(id: string): Promise<AssistantSession | null> {
    const data = await this.store.read();
    return data.sessions.find((session) => session.id === id) ?? null;
  }

  async upsert(session: AssistantSession): Promise<AssistantSession> {
    return this.store.update((data) => {
      const index = data.sessions.findIndex((item) => item.id === session.id);
      if (index >= 0) data.sessions[index] = session;
      else data.sessions.push(session);

      const expiresBefore = Date.now() - 24 * 60 * 60 * 1000;
      data.sessions = data.sessions
        .filter((item) => Date.parse(item.updatedAt) >= expiresBefore)
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
        .slice(0, 500);
      return session;
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.store.update((data) => {
      const initialLength = data.sessions.length;
      data.sessions = data.sessions.filter((session) => session.id !== id);
      return data.sessions.length !== initialLength;
    });
  }
}
