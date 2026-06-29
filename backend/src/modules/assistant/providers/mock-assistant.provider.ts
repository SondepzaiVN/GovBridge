import type {
  AssistantProvider,
  AssistantResult,
  AssistantTool,
  AssistantToolContext,
  ConversationMessage,
} from '../assistant.types.js';

export class MockAssistantProvider implements AssistantProvider {
  readonly name = 'mock';

  constructor(private readonly tools: AssistantTool[]) {}

  async sendMessage(
    context: AssistantToolContext,
    _history: ConversationMessage[]
  ): Promise<AssistantResult> {
    const tool = this.tools.find((candidate) => candidate.canHandle(context));
    if (!tool) throw new Error('Assistant tool registry must contain a fallback tool.');
    return tool.execute(context);
  }
}
