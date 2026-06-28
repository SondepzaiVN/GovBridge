import type { ErrorDetail } from '../../common/errors/app-error.js';
import type { Procedure, ProcedureField } from '../procedures/procedure.types.js';

const phonePattern = /^0[3-9]\d{8}$/;
const cccdPattern = /^(?:\d{9}|\d{12})$/;

const isValidIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
};

const validateField = (field: ProcedureField, rawValue: string): ErrorDetail | null => {
  const value = rawValue.trim();

  if (field.required && !value) {
    return { field: field.id, code: 'REQUIRED', message: 'Vui lòng nhập ' + field.label.toLowerCase() + '.' };
  }
  if (!value) return null;

  if (field.validation?.minLength !== undefined && value.length < field.validation.minLength) {
    return { field: field.id, code: 'MIN_LENGTH', message: field.label + ' quá ngắn.' };
  }
  if (field.validation?.maxLength !== undefined && value.length > field.validation.maxLength) {
    return { field: field.id, code: 'MAX_LENGTH', message: field.label + ' quá dài.' };
  }

  if (field.validation?.pattern) {
    const pattern = new RegExp(field.validation.pattern);
    if (!pattern.test(value)) {
      return {
        field: field.id,
        code: 'PATTERN',
        message: field.validation.message ?? field.label + ' không đúng định dạng.',
      };
    }
  }

  if (field.type === 'phone' && !phonePattern.test(value.replace(/[\s.-]/g, ''))) {
    return { field: field.id, code: 'PHONE', message: 'Số điện thoại Việt Nam không hợp lệ.' };
  }

  const normalizedId = field.id.toLowerCase();
  if (normalizedId.includes('cccd') && !cccdPattern.test(value.replace(/\s/g, ''))) {
    return { field: field.id, code: 'CCCD', message: 'CCCD phải có 9 hoặc 12 chữ số.' };
  }

  if (field.type === 'date') {
    if (!isValidIsoDate(value)) {
      return { field: field.id, code: 'DATE', message: field.label + ' phải có định dạng YYYY-MM-DD.' };
    }
    if (normalizedId.includes('ngaysinh') && new Date(value + 'T00:00:00Z') > new Date()) {
      return { field: field.id, code: 'FUTURE_DATE', message: field.label + ' không thể ở tương lai.' };
    }
  }

  if ((field.type === 'select' || field.type === 'radio') && field.options?.length) {
    if (!field.options.some((option) => option.value === value)) {
      return { field: field.id, code: 'OPTION', message: field.label + ' có giá trị không hợp lệ.' };
    }
  }

  if ((normalizedId.includes('hoten') || normalizedId.includes('tentre')) && value.split(/\s+/).length < 2) {
    return { field: field.id, code: 'FULL_NAME', message: field.label + ' cần có ít nhất 2 từ.' };
  }

  return null;
};

export const validateApplicationData = (
  procedure: Procedure,
  data: Record<string, string>,
): ErrorDetail[] => {
  const details: ErrorDetail[] = [];
  const knownFields = new Set(procedure.fields.map((field) => field.id));

  for (const fieldId of Object.keys(data)) {
    if (!knownFields.has(fieldId)) {
      details.push({ field: fieldId, code: 'UNKNOWN_FIELD', message: 'Trường dữ liệu không thuộc thủ tục.' });
    }
  }

  for (const field of procedure.fields) {
    const detail = validateField(field, data[field.id] ?? '');
    if (detail) details.push(detail);
  }

  return details;
};
