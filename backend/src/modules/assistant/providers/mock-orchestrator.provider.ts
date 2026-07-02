import { normalizeText } from '../../../common/utils/normalize-text.js';
import type {
  AssistantTool,
  OrchestratorFinalResult,
} from '../assistant.types.js';
import type { KnowledgeType } from '../knowledge.types.js';
import type {
  OrchestratorProvider,
  OrchestratorRequest,
  OrchestratorResult,
} from '../orchestrator.types.js';
import { QUERY_PROCEDURE_KNOWLEDGE_TOOL } from '../tools/query-procedure-knowledge.tool.js';

const KNOWLEDGE_TERMS: Array<[KnowledgeType, string[]]> = [
  ['documents', ['giấy tờ', 'thành phần hồ sơ', 'hồ sơ cần', 'chuẩn bị gì']],
  ['forms', ['biểu mẫu', 'mẫu đơn', 'tờ khai']],
  ['conditions', ['điều kiện', 'được quy định', 'kê khai như thế nào']],
  ['eligibility', ['đối tượng', 'ai được']],
  ['process', ['quy trình', 'trình tự', 'các bước', 'hướng dẫn thực hiện']],
  ['submission_method', ['cách nộp', 'nộp trực tuyến', 'nộp online']],
  ['receiving_authority', ['nơi nộp', 'cơ quan tiếp nhận']],
  ['processing_time', ['mất bao lâu', 'bao nhiêu ngày', 'thời hạn', 'thời gian']],
  ['fees', ['lệ phí', 'chi phí', 'bao nhiêu tiền']],
  ['result', ['kết quả thủ tục']],
  ['legal_basis', ['căn cứ pháp lý', 'văn bản nào', 'điều khoản']],
  ['terminology', ['thuật ngữ', 'có nghĩa là gì']],
  ['special_case', ['trường hợp đặc biệt', 'ngoại lệ']],
  ['comparison', ['so sánh', 'khác nhau thế nào']],
  ['procedure_identification', ['thủ tục gì', 'thủ tục nào']],
];

const classifyKnowledgeType = (message: string): KnowledgeType | null => {
  const normalized = normalizeText(message);
  return KNOWLEDGE_TERMS.find(([, terms]) =>
    terms.some((term) => normalized.includes(normalizeText(term))),
  )?.[0] ?? null;
};

const composeKnowledgeResult = (
  request: OrchestratorRequest,
): OrchestratorFinalResult => {
  const knowledge = request.knowledge;
  if (!knowledge) {
    throw new Error('Knowledge result is required for composition.');
  }

  if (knowledge.result.status === 'provider_error') {
    const message = knowledge.result.errorCode === 'KNOWLEDGE_PROVIDER_TIMEOUT'
      ? 'Dịch vụ tra cứu kiến thức đã quá thời gian chờ. Dữ liệu biểu mẫu của bạn vẫn được giữ nguyên.'
      : 'Dịch vụ tra cứu kiến thức hiện chưa sẵn sàng. Dữ liệu biểu mẫu của bạn vẫn được giữ nguyên; bạn có thể thử lại sau.';
    return {
      response: {
        intent: 'CHAT',
        message,
      },
      actions: [],
      responseProvenance: 'knowledge_composer',
    };
  }
  if (knowledge.result.status === 'no_source') {
    return {
      response: {
        intent: 'CHAT',
        message: 'Mình chưa tìm thấy đủ nguồn để trả lời chắc chắn câu hỏi này.',
      },
      actions: [],
      responseProvenance: 'knowledge_composer',
    };
  }

  return {
    response: {
      intent: 'CHAT',
      message: `Theo thông tin tra cứu được:\n\n${knowledge.result.answer}`,
      ...(knowledge.result.quickReplies.length > 0
        ? { suggestions: knowledge.result.quickReplies.slice(0, 3) }
        : {}),
    },
    actions: [],
    responseProvenance: 'knowledge_composer',
  };
};

export class MockOrchestratorProvider implements OrchestratorProvider {
  readonly name = 'mock-orchestrator';

  constructor(private readonly tools: AssistantTool[]) {}

  async orchestrate(request: OrchestratorRequest): Promise<OrchestratorResult> {
    if (request.knowledge) {
      const composed = composeKnowledgeResult(request);
      const formTool = this.tools.find((tool) =>
        tool.name === 'form-fill' && tool.canHandle(request.context),
      );
      if (formTool) {
        const formResult = await formTool.execute(request.context);
        if (!formResult.understanding) return { kind: 'final', result: composed };
        return {
          kind: 'final',
          result: {
            ...composed,
            understanding: formResult.understanding,
          },
        };
      }
      return { kind: 'final', result: composed };
    }

    const knowledgeType = classifyKnowledgeType(request.context.message);
    if (knowledgeType) {
      return {
        kind: 'tool_call',
        toolCall: {
          name: QUERY_PROCEDURE_KNOWLEDGE_TOOL,
          arguments: {
            question: request.context.message,
            knowledgeType,
            procedureHint: request.context.currentProcedure
              ? {
                  id: request.context.currentProcedure.id,
                  name: request.context.currentProcedure.name,
                }
              : null,
            selectedCaseHint: null,
            fieldContext: null,
            locality: null,
          },
        },
      };
    }

    const tool = this.tools.find((candidate) => candidate.canHandle(request.context));
    if (!tool) throw new Error('Assistant tool registry must contain a fallback tool.');
    return { kind: 'final', result: await tool.execute(request.context) };
  }
}
