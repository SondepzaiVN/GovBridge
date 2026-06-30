import type { Procedure, ProcedureField } from '../procedures/procedure.types.js';
import type {
  AssistantFormContext,
  AssistantMessageInput,
  AssistantSession,
} from './assistant.types.js';

const MAX_CONTEXT_VALUE_LENGTH = 500;
const MAX_CONTEXT_FIELDS = 40;

const compactValue = (value: string): string => value.trim().slice(0, MAX_CONTEXT_VALUE_LENGTH);

const getCurrentStep = (route: string): number | null => {
  const match = route.match(/\/buoc-(\d+)\/?$/);
  if (!match?.[1]) return null;
  const step = Number(match[1]);
  return Number.isInteger(step) && step > 0 ? step : null;
};

const isFieldRelevantToStep = (field: ProcedureField, currentStep: number | null): boolean =>
  currentStep === null || field.step === undefined || field.step === currentStep;

const selectSchemaValues = (
  procedure: Procedure | null,
  values: Record<string, string> | undefined,
  useCccdMapping = false,
): Record<string, string> => {
  if (!procedure || !values) return {};
  const selectedValues: Array<[string, string]> = [];

  for (const field of procedure.fields) {
    const sourceKey = useCccdMapping ? field.cccdKey ?? field.id : field.id;
    const value = values[sourceKey];
    if (!value || !compactValue(value)) continue;
    selectedValues.push([field.id, compactValue(value)]);
    if (selectedValues.length >= MAX_CONTEXT_FIELDS) break;
  }

  return Object.fromEntries(selectedValues);
};

export const buildAssistantFormContext = (
  input: AssistantMessageInput,
  existing: AssistantSession | null,
  currentProcedure: Procedure | null,
  currentRoute: string,
): AssistantFormContext => {
  const knownFields = selectSchemaValues(currentProcedure, input.formValues);
  const previousValues = existing?.state?.formSnapshot ?? {};
  const currentStep = getCurrentStep(currentRoute);

  const recentChanges = Object.fromEntries(
    Object.entries(knownFields)
      .filter(([fieldId, value]) => previousValues[fieldId] !== value)
      .slice(0, 15),
  );

  const missingRequiredFields = currentProcedure?.fields
    .filter((field) =>
      field.required
      && isFieldRelevantToStep(field, currentStep)
      && !knownFields[field.id]?.trim(),
    )
    .slice(0, 20)
    .map((field) => ({ id: field.id, label: field.label })) ?? [];

  return {
    currentStep,
    currentSection: input.currentSection?.trim() || null,
    knownFields,
    missingRequiredFields,
    recentChanges,
    candidateCases: existing?.state?.candidateCases ?? [],
    recentOcrFacts: selectSchemaValues(currentProcedure, input.recentOcrFacts, true),
  };
};
