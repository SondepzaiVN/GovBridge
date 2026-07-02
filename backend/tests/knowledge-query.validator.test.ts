import { beforeAll, describe, expect, it } from 'vitest';
import {
  validateAndCanonicalizeKnowledgeQuery,
  type KnowledgeQueryValidationContext,
} from '../src/modules/assistant/knowledge-query.validator.js';
import type { ConfirmedProcedureCase } from '../src/modules/assistant/assistant.types.js';
import type { KnowledgeQuery } from '../src/modules/assistant/knowledge.types.js';
import { ProcedureRepository } from '../src/modules/procedures/procedure.repository.js';
import type { Procedure } from '../src/modules/procedures/procedure.types.js';

let procedures: Procedure[];

beforeAll(async () => {
  procedures = await new ProcedureRepository('src/storage/data').findAll();
});

const procedureById = (id: string): Procedure => {
  const procedure = procedures.find((candidate) => candidate.id === id);
  if (!procedure) throw new Error(`Missing procedure fixture: ${id}`);
  return procedure;
};

const createArguments = (
  overrides: Partial<KnowledgeQuery> = {},
): KnowledgeQuery => ({
  question: 'Câu hỏi do model gửi',
  knowledgeType: 'documents',
  procedureHint: null,
  selectedCaseHint: null,
  fieldContext: null,
  locality: null,
  ...overrides,
});

const createContext = ({
  message = 'Cần giấy tờ gì?',
  currentProcedure = null,
  confirmedCase = null,
}: {
  message?: string;
  currentProcedure?: Procedure | null;
  confirmedCase?: ConfirmedProcedureCase | null;
} = {}): KnowledgeQueryValidationContext => ({
  message,
  currentProcedure,
  procedures,
  confirmedCase,
});

describe('validateAndCanonicalizeKnowledgeQuery', () => {
  it('resolves the canonical procedure from the current route context', () => {
    const result = validateAndCanonicalizeKnowledgeQuery(
      createContext({ currentProcedure: procedureById('ho-khau') }),
      createArguments({
        procedureHint: { id: 'fake', name: 'Tên giả' },
      }),
    );

    expect(result.procedureHint).toEqual({
      id: 'ho-khau',
      name: 'Đăng ký thường trú',
    });
  });

  it('does not change another route to permanent residence', () => {
    const result = validateAndCanonicalizeKnowledgeQuery(
      createContext({ currentProcedure: procedureById('cccd') }),
      createArguments({
        procedureHint: { id: 'ho-khau', name: 'Đăng ký thường trú' },
      }),
    );

    expect(result.procedureHint).toEqual({
      id: 'cccd',
      name: 'Cấp lại CCCD',
    });
  });

  it('returns null on home/unknown route when no procedure is verified', () => {
    const result = validateAndCanonicalizeKnowledgeQuery(
      createContext(),
      createArguments({
        procedureHint: { id: 'does-not-exist', name: 'Thủ tục bịa' },
      }),
    );

    expect(result.procedureHint).toBeNull();

    const validButUnsupportedHint = validateAndCanonicalizeKnowledgeQuery(
      createContext(),
      createArguments({
        procedureHint: { id: 'ho-khau', name: 'Đăng ký thường trú' },
      }),
    );
    expect(validButUnsupportedHint.procedureHint).toBeNull();
  });

  it('does not use a permanent-residence fallback for an ambiguous keyword', () => {
    const result = validateAndCanonicalizeKnowledgeQuery(
      createContext({ message: 'Thường trú cần giấy tờ gì?' }),
      createArguments({
        procedureHint: { id: 'ho-khau', name: 'Đăng ký thường trú' },
      }),
    );

    expect(result.procedureHint).toBeNull();
  });

  it('ignores a real hint when the message supports a different procedure', () => {
    const result = validateAndCanonicalizeKnowledgeQuery(
      createContext({
        message: 'Cấp lại CCCD cần giấy tờ gì?',
        currentProcedure: procedureById('cccd'),
      }),
      createArguments({
        procedureHint: { id: 'ho-khau', name: 'Đăng ký thường trú' },
      }),
    );

    expect(result.procedureHint?.id).toBe('cccd');
  });

  it('switches from the current route only when the message uniquely names another real procedure', () => {
    const result = validateAndCanonicalizeKnowledgeQuery(
      createContext({
        message: 'Cấp lại CCCD cần giấy tờ gì?',
        currentProcedure: procedureById('ho-khau'),
      }),
      createArguments({
        procedureHint: { id: 'cccd', name: 'Cấp lại CCCD' },
      }),
    );

    expect(result.procedureHint).toEqual({
      id: 'cccd',
      name: 'Cấp lại CCCD',
    });
  });

  it('keeps an exact field id only when the message references that field and uses the schema label', () => {
    const result = validateAndCanonicalizeKnowledgeQuery(
      createContext({
        message: 'Trường Họ tên được quy định và kê khai thế nào?',
        currentProcedure: procedureById('ho-khau'),
      }),
      createArguments({
        fieldContext: { fieldId: 'hoTen', fieldLabel: 'Nhãn do model sửa' },
      }),
    );

    expect(result.fieldContext).toEqual({
      fieldId: 'hoTen',
      fieldLabel: 'Họ tên',
    });
  });

  it('drops unknown, cross-procedure and system-managed fields', () => {
    const context = createContext({
      message: 'CCCD cũ và Cơ quan đăng ký cư trú được kê khai thế nào?',
      currentProcedure: procedureById('ho-khau'),
    });

    expect(validateAndCanonicalizeKnowledgeQuery(
      context,
      createArguments({
        fieldContext: { fieldId: 'cccdCu', fieldLabel: 'Số CCCD cũ' },
      }),
    ).fieldContext).toBeNull();
    expect(validateAndCanonicalizeKnowledgeQuery(
      context,
      createArguments({
        fieldContext: { fieldId: 'coQuanDKCT', fieldLabel: 'Nhãn giả' },
      }),
    ).fieldContext).toBeNull();
  });

  it('never promotes a candidate/model case to confirmed state', () => {
    const result = validateAndCanonicalizeKnowledgeQuery(
      createContext({ currentProcedure: procedureById('ho-khau') }),
      createArguments({ selectedCaseHint: 'case do model đề nghị' }),
    );

    expect(result.selectedCaseHint).toBeNull();
  });

  it('uses a confirmed case only when its id is canonical for the resolved procedure', () => {
    const result = validateAndCanonicalizeKnowledgeQuery(
      createContext({
        currentProcedure: procedureById('ho-khau'),
        confirmedCase: {
          id: 'lap_ho_moi',
          procedureId: 'ho-khau',
        },
      }),
      createArguments({ selectedCaseHint: 'case do model bịa' }),
    );

    expect(result.selectedCaseHint).toBe('Đăng ký thường trú lập hộ mới');

    const wrongProcedure = validateAndCanonicalizeKnowledgeQuery(
      createContext({
        currentProcedure: procedureById('cccd'),
        confirmedCase: {
          id: 'lap_ho_moi',
          procedureId: 'ho-khau',
        },
      }),
      createArguments(),
    );
    expect(wrongProcedure.selectedCaseHint).toBeNull();
  });

  it.each([
    { label: 'enum', value: createArguments({ knowledgeType: 'documents' }) },
    { label: 'type', value: { ...createArguments(), locality: 123 } },
    { label: 'extra key', value: { ...createArguments(), unexpected: true } },
    { label: 'empty versus null', value: { ...createArguments(), selectedCaseHint: '' } },
  ])('rejects structurally invalid arguments: $label', ({ label, value }) => {
    const invalidValue = label === 'enum'
      ? { ...value, knowledgeType: 'not-a-knowledge-type' }
      : value;
    expect(() => validateAndCanonicalizeKnowledgeQuery(
      createContext(),
      invalidValue,
    )).toThrow(expect.objectContaining({ code: 'INVALID_KNOWLEDGE_QUERY' }));
  });

  it('uses the backend message as question and returns newly canonical objects', () => {
    const modelProcedureHint = { id: 'ho-khau', name: 'Tên do model sửa' };
    const result = validateAndCanonicalizeKnowledgeQuery(
      createContext({
        message: 'Đăng ký thường trú cần giấy tờ gì?',
        currentProcedure: procedureById('ho-khau'),
      }),
      createArguments({
        question: 'Câu hỏi do model tự thay thế',
        procedureHint: modelProcedureHint,
      }),
    );

    expect(result.question).toBe('Đăng ký thường trú cần giấy tờ gì?');
    expect(result.procedureHint).toEqual({
      id: 'ho-khau',
      name: 'Đăng ký thường trú',
    });
    expect(result.procedureHint).not.toBe(modelProcedureHint);
  });

  it('keeps only a province-level locality explicitly present in the backend message', () => {
    const valid = validateAndCanonicalizeKnowledgeQuery(
      createContext({ message: 'Thủ tục này thực hiện tại thành phố Cần Thơ?' }),
      createArguments({ locality: 'Cần Thơ' }),
    );
    expect(valid.locality).toBe('Cần Thơ');

    const district = validateAndCanonicalizeKnowledgeQuery(
      createContext({ message: 'Tôi ở quận Ninh Kiều, thành phố Cần Thơ' }),
      createArguments({ locality: 'Ninh Kiều' }),
    );
    expect(district.locality).toBeNull();

    const detailedAddress = validateAndCanonicalizeKnowledgeQuery(
      createContext({
        message: 'Địa chỉ của tôi là 12 Lê Lợi, thành phố Cần Thơ.',
      }),
      createArguments({ locality: 'Cần Thơ' }),
    );
    expect(detailedAddress.locality).toBeNull();
  });
});
