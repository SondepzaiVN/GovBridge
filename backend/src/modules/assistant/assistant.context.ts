import type { Procedure, ProcedureField } from '../procedures/procedure.types.js';
import type {
  AssistantDocumentReviewContext,
  AssistantFormContext,
  AssistantMessageInput,
  AssistantPageContext,
  AssistantSession,
} from './assistant.types.js';

const MAX_CONTEXT_VALUE_LENGTH = 500;
const MAX_CONTEXT_FIELDS = 40;
const MAX_VISIBLE_FIELDS = 40;
const MAX_VISIBLE_FIELD_OPTIONS = 12;
const MAX_DOCUMENT_REVIEWS = 3;
const MAX_DOCUMENT_REVIEW_TEXT_LENGTH = 800;
const MAX_DOCUMENT_REVIEW_WARNINGS = 5;
const MAX_PAGE_CONTEXT_SECTIONS = 8;
const MAX_PAGE_CONTEXT_CASES = 12;
const MAX_PAGE_CONTEXT_REQUIREMENTS = 8;
const MAX_PAGE_CONTEXT_CHECKLIST_ITEMS = 12;

const compactValue = (value: string): string => value.trim().slice(0, MAX_CONTEXT_VALUE_LENGTH);

const getCurrentStep = (route: string): number | null => {
  const match = route.match(/\/buoc-(\d+)\/?$/);
  if (!match?.[1]) return null;
  const step = Number(match[1]);
  return Number.isInteger(step) && step > 0 ? step : null;
};

const isFieldRelevantToStep = (field: ProcedureField, currentStep: number | null): boolean =>
  currentStep === null || field.step === undefined || field.step === currentStep;

const compactVisibleFieldOptions = (
  field: ProcedureField,
): Array<{ value: string; label: string }> | undefined => {
  if (!field.options || field.options.length === 0 || field.options.length > MAX_VISIBLE_FIELD_OPTIONS) {
    return undefined;
  }

  return field.options.map((option) => ({
    value: compactValue(option.value).slice(0, 120),
    label: compactValue(option.label).slice(0, 200),
  }));
};

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

const compactDocumentReviews = (
  reviews: AssistantMessageInput['recentDocumentReviews'],
): AssistantDocumentReviewContext[] => (reviews ?? [])
  .flatMap((review) => {
    const label = review.label.trim().slice(0, 200);
    const text = review.text.trim().slice(0, MAX_DOCUMENT_REVIEW_TEXT_LENGTH);
    if (!label || !text) return [];

    return [{
      label,
      ...(review.fileName ? { fileName: review.fileName.trim().slice(0, 200) } : {}),
      ...(review.documentType ? { documentType: review.documentType } : {}),
      status: review.status,
      ...(review.flag ? { flag: review.flag } : {}),
      text,
      warnings: review.warnings
        .map((warning) => warning.trim().slice(0, 300))
        .filter(Boolean)
        .slice(0, MAX_DOCUMENT_REVIEW_WARNINGS),
      ...(review.readerProvider ? { readerProvider: review.readerProvider.trim().slice(0, 80) } : {}),
      ...(review.reviewerProvider ? { reviewerProvider: review.reviewerProvider.trim().slice(0, 80) } : {}),
      ...(review.checkedAt ? { checkedAt: review.checkedAt.trim().slice(0, 40) } : {}),
    }];
  })
  .slice(0, MAX_DOCUMENT_REVIEWS);

const compactPageContext = (pageContext: AssistantMessageInput['pageContext']): AssistantPageContext | null => {
  if (!pageContext?.pageId.trim()) return null;

  const residenceRegistration = pageContext.residenceRegistration
    ? {
        ...(pageContext.residenceRegistration.procedureCase
          ? { procedureCase: compactValue(pageContext.residenceRegistration.procedureCase).slice(0, 120) }
          : {}),
        ...(pageContext.residenceRegistration.registrationMode
          ? { registrationMode: compactValue(pageContext.residenceRegistration.registrationMode).slice(0, 120) }
          : {}),
        ...(typeof pageContext.residenceRegistration.isOverseasDossier === 'boolean'
          ? { isOverseasDossier: pageContext.residenceRegistration.isOverseasDossier }
          : {}),
        ...(pageContext.residenceRegistration.openUploadCaseId
          ? { openUploadCaseId: compactValue(pageContext.residenceRegistration.openUploadCaseId).slice(0, 120) }
          : {}),
        uploadCases: (pageContext.residenceRegistration.uploadCases ?? [])
          .filter((item) => item.id.trim() && item.title.trim())
          .slice(0, MAX_PAGE_CONTEXT_CASES)
          .map((item) => ({
            id: compactValue(item.id).slice(0, 120),
            title: compactValue(item.title),
            ...(typeof item.isVisible === 'boolean' ? { isVisible: item.isVisible } : {}),
            ...(typeof item.isOpen === 'boolean' ? { isOpen: item.isOpen } : {}),
            ...(item.selectionHint ? { selectionHint: compactValue(item.selectionHint).slice(0, 300) } : {}),
            requirements: (item.requirements ?? [])
              .filter((requirement) => requirement.id.trim() && requirement.name.trim())
              .slice(0, MAX_PAGE_CONTEXT_REQUIREMENTS)
              .map((requirement) => ({
                id: compactValue(requirement.id).slice(0, 120),
                name: compactValue(requirement.name).slice(0, 300),
                required: requirement.required,
                ...(typeof requirement.selected === 'boolean' ? { selected: requirement.selected } : {}),
                ...(typeof requirement.hasFile === 'boolean' ? { hasFile: requirement.hasFile } : {}),
                ...(typeof requirement.fileCount === 'number' ? { fileCount: requirement.fileCount } : {}),
                ...(typeof requirement.canUseSpecializedData === 'boolean'
                  ? { canUseSpecializedData: requirement.canUseSpecializedData }
                  : {}),
                ...(typeof requirement.useSpecializedData === 'boolean'
                  ? { useSpecializedData: requirement.useSpecializedData }
                  : {}),
                ...(requirement.guidance ? { guidance: compactValue(requirement.guidance).slice(0, 250) } : {}),
              })),
          })),
      }
    : undefined;

  return {
    pageId: compactValue(pageContext.pageId).slice(0, 120),
    currentSection: pageContext.currentSection ? compactValue(pageContext.currentSection).slice(0, 120) : null,
    sections: (pageContext.sections ?? [])
      .filter((section) => section.id.trim() && section.title.trim())
      .slice(0, MAX_PAGE_CONTEXT_SECTIONS)
      .map((section) => ({
        id: compactValue(section.id).slice(0, 120),
        title: compactValue(section.title).slice(0, 300),
        ...(typeof section.isOpen === 'boolean' ? { isOpen: section.isOpen } : {}),
        ...(typeof section.isVisible === 'boolean' ? { isVisible: section.isVisible } : {}),
      })),
    submissionChecklist: (pageContext.submissionChecklist ?? [])
      .filter((item) => item.id.trim() && item.label.trim())
      .slice(0, MAX_PAGE_CONTEXT_CHECKLIST_ITEMS)
      .map((item) => ({
        id: compactValue(item.id).slice(0, 120),
        label: compactValue(item.label).slice(0, 300),
        required: item.required,
        completed: item.completed,
        ...(item.reminder ? { reminder: compactValue(item.reminder).slice(0, 300) } : {}),
      })),
    ...(residenceRegistration ? { residenceRegistration } : {}),
  };
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

  // Trích xuất danh sách field ID phẳng từ cấu trúc phân tầng.
  const groups = input.visibleFieldGroups ?? [];
  const visibleFieldIds = new Set<string>(
    [
      ...(input.visibleFieldIds ?? []),
      ...groups.flatMap((group) => group.fieldIds),
    ]
      .map((fieldId) => fieldId.trim())
      .filter(Boolean),
  );

  // Lookup: fieldId -> sectionTitle của nhóm chứa field đó.
  const fieldSectionTitleMap = new Map<string, string>();
  // Lookup: fieldId -> isPrimaryFocus của nhóm chứa field đó.
  const fieldIsPrimaryFocusMap = new Map<string, boolean>();
  for (const group of groups) {
    for (const fieldId of group.fieldIds) {
      if (group.sectionTitle) fieldSectionTitleMap.set(fieldId, group.sectionTitle);
      if (group.isPrimaryFocus) fieldIsPrimaryFocusMap.set(fieldId, true);
    }
  }

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

  // IDs từ trình duyệt chỉ là gợi ý. Luôn dựng lại metadata từ schema backend
  // để frontend không thể tự tạo field hoặc thay đổi nhãn/kiểu dữ liệu.
  const importantVisibleFields = currentProcedure?.fields
    .filter((field) => visibleFieldIds.has(field.id))
    .slice(0, MAX_VISIBLE_FIELDS)
    .map((field) => {
      const options = compactVisibleFieldOptions(field);
      const sectionTitle = fieldSectionTitleMap.get(field.id);
      const isPrimaryFocus = fieldIsPrimaryFocusMap.get(field.id) ?? false;
      return {
        id: field.id,
        label: field.label,
        type: field.type,
        required: field.required,
        isEmpty: !knownFields[field.id]?.trim(),
        priority: 'high' as const,
        ...(sectionTitle ? { sectionTitle } : {}),
        ...(isPrimaryFocus ? { isPrimaryFocus } : {}),
        ...(options ? { options } : {}),
      };
    }) ?? [];

  return {
    currentStep,
    currentSection: input.currentSection?.trim() || input.pageContext?.currentSection?.trim() || null,
    pageContext: compactPageContext(input.pageContext),
    knownFields,
    missingRequiredFields,
    importantVisibleFields,
    recentChanges,
    candidateCases: existing?.state?.candidateCases ?? [],
    recentOcrFacts: selectSchemaValues(currentProcedure, input.recentOcrFacts, true),
    recentDocumentReviews: compactDocumentReviews(input.recentDocumentReviews),
  };
};
