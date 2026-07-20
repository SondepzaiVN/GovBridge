import { z } from 'zod';

const assistantDocumentReviewSchema = z.object({
  label: z.string().trim().min(1).max(200),
  fileName: z.string().trim().max(200).optional(),
  documentType: z.enum(['ct01', 'chung_minh_cho_o_hop_phap']).optional(),
  status: z.enum(['valid', 'invalid', 'error']),
  flag: z.enum(['green', 'red']).optional(),
  text: z.string().trim().min(1).max(1_500),
  warnings: z.array(z.string().trim().min(1).max(500)).max(5).default([]),
  readerProvider: z.string().trim().max(80).optional(),
  reviewerProvider: z.string().trim().max(80).optional(),
  checkedAt: z.string().trim().max(40).optional(),
}).strict();

const assistantPageRequirementSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(300),
  required: z.boolean(),
  selected: z.boolean().optional(),
  hasFile: z.boolean().optional(),
  fileCount: z.number().int().min(0).max(50).optional(),
  canUseSpecializedData: z.boolean().optional(),
  useSpecializedData: z.boolean().optional(),
  guidance: z.string().trim().max(300).optional(),
}).strict();

const assistantPageCaseSchema = z.object({
  id: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(500),
  isVisible: z.boolean().optional(),
  isCurrentlyVisible: z.boolean().optional(),
  isOpen: z.boolean().optional(),
  selectionHint: z.string().trim().max(400).optional(),
  requirements: z.array(assistantPageRequirementSchema).max(12).optional(),
}).strict();

const assistantPageSectionSchema = z.object({
  id: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(300),
  isOpen: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  isCurrentlyVisible: z.boolean().optional(),
}).strict();

const assistantSubmissionChecklistItemSchema = z.object({
  id: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(300),
  required: z.boolean(),
  completed: z.boolean(),
  reminder: z.string().trim().max(300).optional(),
}).strict();

const assistantPageContextSchema = z.object({
  pageId: z.string().trim().min(1).max(120),
  currentSection: z.string().trim().max(120).nullable().optional(),
  sections: z.array(assistantPageSectionSchema).max(12).optional(),
  submissionChecklist: z.array(assistantSubmissionChecklistItemSchema).max(12).optional(),
  residenceRegistration: z.object({
    procedureCase: z.string().trim().max(120).optional(),
    registrationMode: z.string().trim().max(120).optional(),
    isOverseasDossier: z.boolean().optional(),
    openUploadCaseId: z.string().trim().max(120).optional(),
    uploadCases: z.array(assistantPageCaseSchema).max(12).optional(),
  }).strict().optional(),
}).strict();

const visibleFieldGroupSchema = z.object({
  sectionId: z.string().trim().min(1).max(120).optional(),
  sectionTitle: z.string().trim().min(1).max(200).optional(),
  fieldIds: z.array(z.string().trim().min(1).max(100)).max(50),
  isPrimaryFocus: z.boolean().optional(),
}).strict();

const clientInterruptedAssistantMessageSchema = z.object({
  content: z.string().trim().min(1).max(4_000),
  createdAt: z.string().trim().max(40).optional(),
}).strict();

export const assistantMessageSchema = z.object({
  sessionId: z.string().trim().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  message: z.string().trim().min(1).max(4_000),
  currentRoute: z.string().trim().max(300).default('/'),
  formValues: z.record(z.string().max(10_000)).default({}),
  currentSection: z.string().trim().max(100).optional(),
  pageContext: assistantPageContextSchema.optional(),
  recentOcrFacts: z.record(z.string().max(2_000)).default({}),
  recentDocumentReviews: z.array(assistantDocumentReviewSchema).max(3).default([]),
  /** Legacy flat list kept for tests/older frontend payloads. */
  visibleFieldIds: z.array(z.string().trim().min(1).max(100)).max(80).default([]),
  /** Danh sách field phân tầng theo khu vực đang hiển thị trên màn hình. */
  visibleFieldGroups: z.array(visibleFieldGroupSchema).max(20).default([]),
  clientInterruptedAssistantMessages: z.array(clientInterruptedAssistantMessageSchema).max(5).default([]),
}).strict();

export const assistantSessionParamsSchema = z.object({
  sessionId: z.string().trim().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/),
});
