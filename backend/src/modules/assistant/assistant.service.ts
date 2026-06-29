import { randomUUID } from 'node:crypto';
import { normalizeText } from '../../common/utils/normalize-text.js';
import type { ProcedureRepository } from '../procedures/procedure.repository.js';
import type { AssistantSessionRepository } from './assistant.repository.js';
import type {
  AssistantApiResult,
  AssistantMessageInput,
  AssistantSession,
  AssistantProvider,
  AssistantToolContext,
} from './assistant.types.js';

export class AssistantService {
  constructor(
    private readonly sessions: AssistantSessionRepository,
    private readonly procedures: ProcedureRepository,
    private readonly provider: AssistantProvider,
  ) {}

  async sendMessage(input: AssistantMessageInput): Promise<AssistantApiResult> {
    const sessionId = input.sessionId ?? randomUUID();
    const now = new Date().toISOString();
    const existing = await this.sessions.findById(sessionId);
    const currentRoute = input.currentRoute ?? existing?.currentRoute ?? '/';
    const allProcedures = await this.procedures.findAll();
    const currentProcedure = await this.procedures.findByRoute(currentRoute);

    const context: AssistantToolContext = {
      message: input.message,
      normalizedMessage: normalizeText(input.message),
      currentRoute,
      currentProcedure,
      procedures: allProcedures,
      formValues: input.formValues ?? {},
    };

    const history = existing?.messages ?? [];
    const result = await this.provider.sendMessage(context, history);

    const session: AssistantSession = {
      id: sessionId,
      currentRoute,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      messages: [
        ...history,
        { role: 'user' as const, content: input.message, createdAt: now },
        { role: 'assistant' as const, content: result.response.message, createdAt: now },
      ].slice(-20),
    };
    await this.sessions.upsert(session);

    return { sessionId, ...result };
  }

  async clearSession(sessionId: string): Promise<{ deleted: boolean }> {
    return { deleted: await this.sessions.delete(sessionId) };
  }
}
