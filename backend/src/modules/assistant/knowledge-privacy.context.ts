import { normalizeText } from '../../common/utils/normalize-text.js';
import type { Procedure, ProcedureField } from '../procedures/procedure.types.js';
import type { AssistantFormContext } from './assistant.types.js';
import type {
  KnowledgePrivacyContext,
  KnownPiiType,
  KnownPiiValue,
} from './knowledge.types.js';

const MAX_KNOWN_PII_VALUES = 40;

const compactIdentifier = (value: string): string =>
  normalizeText(value).replace(/\s+/g, '');

const classifyPiiField = (field: ProcedureField): KnownPiiType | null => {
  const searchable = normalizeText(`${field.id} ${field.label}`);
  const compact = compactIdentifier(`${field.id} ${field.label}`);

  if (/(?:cccd|cmnd|cancuoc|dinhdanh)/u.test(compact)) return 'cccd';
  if (field.type === 'phone' || /(?:sdt|dienthoai|phone)/u.test(compact)) return 'phone';
  if (/(?:email|thudientu)/u.test(compact)) return 'email';
  if (/(?:ngay sinh|ngaysinh|sinh ngay)/u.test(searchable)) return 'date_of_birth';
  if (/(?:ho ten|hoten|ten nguoi|ten cha|ten me|ten tre)/u.test(searchable)) {
    return 'person_name';
  }
  if (/(?:dia chi|diachi|noi o|noio|thuong tru|thuongtru|tam tru|tamtru)/u.test(searchable)) {
    return 'specific_address';
  }
  if (/(?:ho chieu|hochieu|passport|ma so thue|masothue|bao hiem|baohiem)/u.test(searchable)) {
    return 'other_identifier';
  }
  return null;
};

const addKnownValues = (
  target: KnownPiiValue[],
  procedure: Procedure,
  values: Record<string, string>,
): void => {
  for (const field of procedure.fields) {
    const type = classifyPiiField(field);
    const value = values[field.id]?.trim();
    if (!type || !value) continue;
    target.push({ type, value });
  }
};

export const buildKnowledgePrivacyContext = (
  procedure: Procedure | null,
  formContext: AssistantFormContext,
): KnowledgePrivacyContext => {
  if (!procedure) return { knownPii: [] };

  const candidates: KnownPiiValue[] = [];
  addKnownValues(candidates, procedure, formContext.knownFields);
  addKnownValues(candidates, procedure, formContext.recentOcrFacts);

  const seen = new Set<string>();
  const knownPii = candidates.filter(({ type, value }) => {
    const key = `${type}:${value.toLocaleLowerCase('vi')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_KNOWN_PII_VALUES);

  return { knownPii };
};
