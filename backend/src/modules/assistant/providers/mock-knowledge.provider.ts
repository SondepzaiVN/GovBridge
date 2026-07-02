import type {
  KnowledgeProvider,
  KnowledgeProviderRequest,
  KnowledgeResult,
} from '../knowledge.types.js';

type MockKnowledgeResponder = (
  request: KnowledgeProviderRequest,
) => KnowledgeResult | Promise<KnowledgeResult>;

const defaultResponder: MockKnowledgeResponder = (request) => ({
  answer: request.query.procedureHint
    ? `Đây là thông tin kiến thức mô phỏng cho thủ tục **${request.query.procedureHint.name}**.`
    : 'Đây là thông tin kiến thức mô phỏng từ danh mục thủ tục.',
  references: [],
  quickReplies: [],
  provider: 'mock-knowledge',
  status: 'success',
});

export class MockKnowledgeProvider implements KnowledgeProvider {
  readonly name = 'mock-knowledge';
  readonly requests: KnowledgeProviderRequest[] = [];

  constructor(private readonly respond: MockKnowledgeResponder = defaultResponder) {}

  async query(request: KnowledgeProviderRequest): Promise<KnowledgeResult> {
    this.requests.push(request);
    return this.respond(request);
  }
}
