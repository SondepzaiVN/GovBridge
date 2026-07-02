import { KNOWLEDGE_TYPES } from '../knowledge.types.js';

export const QUERY_PROCEDURE_KNOWLEDGE_TOOL = 'query_procedure_knowledge' as const;

export const queryProcedureKnowledgeToolDefinition = {
  type: 'function',
  name: QUERY_PROCEDURE_KNOWLEDGE_TOOL,
  description: [
    'Tra cứu nguồn kiến thức thủ tục hành chính khi câu hỏi cần căn cứ về điều kiện,',
    'giấy tờ, biểu mẫu, quy trình, cách/nơi nộp, cơ quan tiếp nhận, thời hạn, phí,',
    'kết quả, căn cứ pháp lý, thuật ngữ, trường hợp đặc biệt hoặc so sánh.',
    'Không gọi khi người dùng chỉ cung cấp dữ liệu form, xác nhận, điều hướng hoặc hỏi schema UI.',
  ].join(' '),
  strict: true,
  parameters: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'Câu hỏi nguyên nghĩa hiện tại của người dân.',
      },
      knowledgeType: {
        type: 'string',
        enum: KNOWLEDGE_TYPES,
      },
      procedureHint: {
        anyOf: [
          {
            type: 'object',
            properties: {
              id: { type: ['string', 'null'] },
              name: { type: ['string', 'null'] },
            },
            required: ['id', 'name'],
            additionalProperties: false,
          },
          { type: 'null' },
        ],
      },
      selectedCaseHint: { type: ['string', 'null'] },
      fieldContext: {
        anyOf: [
          {
            type: 'object',
            properties: {
              fieldId: { type: ['string', 'null'] },
              fieldLabel: { type: ['string', 'null'] },
            },
            required: ['fieldId', 'fieldLabel'],
            additionalProperties: false,
          },
          { type: 'null' },
        ],
      },
      locality: { type: ['string', 'null'] },
    },
    required: [
      'question',
      'knowledgeType',
      'procedureHint',
      'selectedCaseHint',
      'fieldContext',
      'locality',
    ],
    additionalProperties: false,
  },
} as const;
