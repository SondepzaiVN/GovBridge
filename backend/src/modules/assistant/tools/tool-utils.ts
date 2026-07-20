import { normalizeText } from '../../../common/utils/normalize-text.js';
import type { Procedure } from '../../procedures/procedure.types.js';
import type { AssistantToolContext } from '../assistant.types.js';

export const findRelevantProcedure = (context: AssistantToolContext): Procedure | null => {
  const ranked = context.procedures
    .map((procedure) => ({
      procedure,
      score: Math.max(
        0,
        ...[
          procedure.name,
          procedure.shortName,
          ...procedure.keywords,
          ...(procedure.citizenSituations ?? []),
          ...(procedure.citizenOutcomes ?? []),
          ...(procedure.negativeHints ?? []),
        ]
          .map(normalizeText)
          .filter((keyword) => keyword && context.normalizedMessage.includes(keyword))
          .map((keyword) => keyword.length),
      ),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);
  return ranked[0]?.procedure ?? context.currentProcedure;
};

export const hasAny = (message: string, terms: string[]): boolean =>
  terms.some((term) => message.includes(normalizeText(term)));

export const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
