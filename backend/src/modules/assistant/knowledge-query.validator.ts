import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import { normalizeText } from '../../common/utils/normalize-text.js';
import type { Procedure, ProcedureField } from '../procedures/procedure.types.js';
import type { ConfirmedProcedureCase } from './assistant.types.js';
import {
  KNOWLEDGE_TYPES,
  type KnowledgeQuery,
} from './knowledge.types.js';

const MAX_QUESTION_LENGTH = 4_000;
const SYSTEM_MANAGED_FIELD_IDS = new Set([
  'thuTuc',
  'coQuanDKCT',
  'sdtCoQuan',
  'noiDungDN',
]);

const nullableShortString = z.string().trim().min(1).max(300).nullable();

export const knowledgeQueryArgumentsSchema = z.object({
  question: z.string().trim().min(1).max(MAX_QUESTION_LENGTH),
  knowledgeType: z.enum(KNOWLEDGE_TYPES),
  procedureHint: z.object({
    id: nullableShortString,
    name: nullableShortString,
  }).strict().nullable(),
  selectedCaseHint: z.string().trim().min(1).max(500).nullable(),
  fieldContext: z.object({
    fieldId: nullableShortString,
    fieldLabel: nullableShortString,
  }).strict().nullable(),
  locality: z.string().trim().min(1).max(100).nullable(),
}).strict();

const canonicalQuestionSchema = z.string().trim().min(1).max(MAX_QUESTION_LENGTH);

export interface KnowledgeQueryValidationContext {
  message: string;
  currentProcedure: Procedure | null;
  procedures: Procedure[];
  confirmedCase: ConfirmedProcedureCase | null;
}

const normalizedAliases = (values: string[]): string[] =>
  [...new Set(values.map(normalizeText).filter(Boolean))];

const directAliases = (procedure: Procedure): string[] =>
  normalizedAliases([procedure.id, procedure.name, procedure.shortName]);

const allAliases = (procedure: Procedure): string[] =>
  normalizedAliases([
    procedure.id,
    procedure.name,
    procedure.shortName,
    ...procedure.keywords,
    ...(procedure.citizenSituations ?? []),
    ...(procedure.citizenOutcomes ?? []),
    ...(procedure.negativeHints ?? []),
  ]);

const messageContainsAlias = (message: string, aliases: string[]): boolean =>
  aliases.some((alias) => message.includes(alias));

const uniqueMatch = (
  procedures: Procedure[],
  message: string,
  aliasesFor: (procedure: Procedure) => string[],
): Procedure | null => {
  const scored = procedures
    .map((procedure) => ({
      procedure,
      score: Math.max(
        0,
        ...aliasesFor(procedure)
          .filter((alias) => message.includes(alias))
          .map((alias) => alias.length),
      ),
    }))
    .filter(({ score }) => score > 0);
  const maxScore = Math.max(0, ...scored.map(({ score }) => score));
  const strongest = scored.filter(({ score }) => score === maxScore);
  return strongest.length === 1 ? strongest[0]?.procedure ?? null : null;
};

const resolveMessageProcedure = (
  procedures: Procedure[],
  normalizedMessage: string,
): Procedure | null =>
  uniqueMatch(procedures, normalizedMessage, directAliases)
  ?? uniqueMatch(procedures, normalizedMessage, allAliases);

const resolveHintCandidate = (
  procedures: Procedure[],
  hint: KnowledgeQuery['procedureHint'],
): Procedure | null => {
  if (!hint) return null;
  const idCandidate = hint.id
    ? procedures.find((procedure) => procedure.id === hint.id) ?? null
    : null;
  const normalizedName = normalizeText(hint.name ?? '');
  const nameMatches = normalizedName
    ? procedures.filter((procedure) =>
        normalizeText(procedure.name) === normalizedName
        || normalizeText(procedure.shortName) === normalizedName,
      )
    : [];
  const nameCandidate = nameMatches.length === 1 ? nameMatches[0] ?? null : null;

  if (hint.id && !idCandidate) return null;
  if (hint.name && !nameCandidate) return null;
  if (idCandidate && nameCandidate && idCandidate.id !== nameCandidate.id) return null;
  return idCandidate ?? nameCandidate;
};

const resolveCanonicalProcedure = (
  context: KnowledgeQueryValidationContext,
  query: KnowledgeQuery,
  normalizedMessage: string,
): Procedure | null => {
  const messageProcedure = resolveMessageProcedure(
    context.procedures,
    normalizedMessage,
  );
  const hintCandidate = resolveHintCandidate(context.procedures, query.procedureHint);

  if (messageProcedure) {
    // Hint chỉ có giá trị khi khớp với procedure mà message hỗ trợ duy nhất.
    if (hintCandidate && hintCandidate.id !== messageProcedure.id) return messageProcedure;
    return messageProcedure;
  }
  // Cho phép model phân loại ngữ nghĩa bằng metadata catalog khi câu đời thường
  // không chứa alias nguyên văn; cặp id/name vẫn phải khớp chính xác repository.
  if (hintCandidate) return hintCandidate;
  // Câu hỏi chung trên màn hình thủ tục dùng route canonical do repository đã resolve.
  if (context.currentProcedure) return context.currentProcedure;
  return null;
};

const resolveCanonicalField = (
  procedure: Procedure | null,
  requestedFieldId: string | null | undefined,
  normalizedMessage: string,
): ProcedureField | null => {
  if (!procedure || !requestedFieldId) return null;
  const field = procedure.fields.find((candidate) => candidate.id === requestedFieldId) ?? null;
  if (!field || SYSTEM_MANAGED_FIELD_IDS.has(field.id)) return null;
  const messageReferencesField = messageContainsAlias(
    normalizedMessage,
    normalizedAliases([field.id, field.label]),
  );
  return messageReferencesField ? field : null;
};

const resolveConfirmedCase = (
  confirmedCase: ConfirmedProcedureCase | null,
  procedure: Procedure | null,
): string | null => {
  if (!confirmedCase || !procedure || confirmedCase.procedureId !== procedure.id) return null;
  const id = confirmedCase.id.trim();
  if (!id || id.length > 100) return null;
  const canonicalOption = procedure.fields
    .flatMap((field) => field.options ?? [])
    .find((option) => option.value === id);
  return canonicalOption?.label.trim() || null;
};

const resolveLocality = (
  message: string,
  modelLocality: string | null,
): string | null => {
  if (!modelLocality) return null;
  const candidate = modelLocality.trim();
  const normalizedCandidate = normalizeText(candidate);
  if (
    normalizedCandidate.length < 3
    || normalizedCandidate.split(/\s+/).length < 2
    || normalizedCandidate.split(/\s+/).length > 5
    || /\d|[/\\,]/u.test(candidate)
    || /(?:^|\s)(?:quan|huyen|phuong|xa|duong|so nha)(?:\s|$)/u.test(normalizedCandidate)
  ) {
    return null;
  }

  const lowerMessage = message.toLocaleLowerCase('vi');
  const lowerCandidate = candidate.toLocaleLowerCase('vi');
  const candidateIndex = lowerMessage.indexOf(lowerCandidate);
  if (candidateIndex < 0) return null;
  const rawPrefix = message.slice(0, candidateIndex);
  const currentClause = normalizeText(rawPrefix.split(/[.;?!\n]/u).at(-1) ?? '');
  if (
    /(?:^|\s)(?:dia chi|so nha|toi (?:dang )?o(?: tai)?)(?:\s|$)/u
      .test(currentClause)
  ) {
    return null;
  }
  const prefix = normalizeText(rawPrefix);
  if (!/(?:^|\s)(?:tinh|thanh pho|tp)\s*$/u.test(prefix)) return null;
  const suffix = message.slice(candidateIndex + candidate.length);
  if (suffix && !/^[\s]*[,.;?!]/u.test(suffix)) return null;
  return message.slice(candidateIndex, candidateIndex + candidate.length).trim() || null;
};

export const validateAndCanonicalizeKnowledgeQuery = (
  context: KnowledgeQueryValidationContext,
  untrustedArguments: unknown,
): KnowledgeQuery => {
  const parsed = knowledgeQueryArgumentsSchema.safeParse(untrustedArguments);
  if (!parsed.success) {
    throw new AppError(
      400,
      'INVALID_KNOWLEDGE_QUERY',
      'Tham số tra cứu kiến thức không hợp lệ.',
      parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }

  const canonicalQuestion = canonicalQuestionSchema.safeParse(context.message);
  if (!canonicalQuestion.success) {
    throw new AppError(
      400,
      'INVALID_KNOWLEDGE_CONTEXT',
      'Câu hỏi hiện tại trong backend context không hợp lệ.',
    );
  }

  const normalizedMessage = normalizeText(canonicalQuestion.data);
  const procedure = resolveCanonicalProcedure(context, parsed.data, normalizedMessage);
  const field = resolveCanonicalField(
    procedure,
    parsed.data.fieldContext?.fieldId,
    normalizedMessage,
  );

  return {
    question: canonicalQuestion.data,
    knowledgeType: parsed.data.knowledgeType,
    procedureHint: procedure ? { id: procedure.id, name: procedure.name } : null,
    selectedCaseHint: resolveConfirmedCase(context.confirmedCase, procedure),
    fieldContext: field ? { fieldId: field.id, fieldLabel: field.label } : null,
    locality: resolveLocality(canonicalQuestion.data, parsed.data.locality),
  };
};
