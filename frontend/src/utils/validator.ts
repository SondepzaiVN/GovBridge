import type { ValidationError, FormField, FormValues } from '../types';

// ============================================================
// Individual field validators
// ============================================================

export const validateCCCD = (value: string): ValidationError | null => {
  const clean = value.replace(/\s/g, '');
  if (!clean) return { field: 'cccd', label: 'CCCD', message: 'Vui lòng nhập số CCCD', severity: 'error' };
  if (!/^\d{9}$/.test(clean) && !/^\d{12}$/.test(clean)) {
    return { field: 'cccd', label: 'CCCD', message: 'Số CCCD phải có 9 hoặc 12 chữ số', severity: 'error' };
  }
  return null;
};

export const validatePhone = (value: string): ValidationError | null => {
  const clean = value.replace(/[\s\-\.]/g, '');
  if (!clean) return { field: 'phone', label: 'Số điện thoại', message: 'Vui lòng nhập số điện thoại', severity: 'error' };
  if (!/^(0[3-9]\d{8})$/.test(clean)) {
    return {
      field: 'phone', label: 'Số điện thoại',
      message: 'Số điện thoại không hợp lệ. Cần 10 số, bắt đầu bằng 03x, 05x, 07x, 08x hoặc 09x',
      severity: 'error',
    };
  }
  return null;
};

export const validateNgaySinh = (value: string): ValidationError | null => {
  if (!value) return { field: 'ngaySinh', label: 'Ngày sinh', message: 'Vui lòng nhập ngày sinh', severity: 'error' };
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return { field: 'ngaySinh', label: 'Ngày sinh', message: 'Ngày sinh không hợp lệ', severity: 'error' };
  }
  if (date > new Date()) {
    return { field: 'ngaySinh', label: 'Ngày sinh', message: 'Ngày sinh không thể là ngày trong tương lai', severity: 'error' };
  }
  const age = new Date().getFullYear() - date.getFullYear();
  if (age > 150) {
    return { field: 'ngaySinh', label: 'Ngày sinh', message: 'Năm sinh không hợp lệ', severity: 'error' };
  }
  return null;
};

export const validateHoTen = (value: string): ValidationError | null => {
  if (!value?.trim()) return { field: 'hoTen', label: 'Họ tên', message: 'Vui lòng nhập họ và tên', severity: 'error' };
  if (value.trim().split(/\s+/).length < 2) {
    return { field: 'hoTen', label: 'Họ tên', message: 'Họ tên cần ít nhất 2 từ (họ và tên)', severity: 'error' };
  }
  if (/[0-9!@#$%^&*()_+=\[\]{};':"\\|,.<>\/?]/.test(value)) {
    return { field: 'hoTen', label: 'Họ tên', message: 'Họ tên không được chứa số hoặc ký tự đặc biệt', severity: 'error' };
  }
  return null;
};

export const validateRequired = (value: string, fieldLabel: string): ValidationError | null => {
  if (!value?.trim()) {
    return { field: '', label: fieldLabel, message: `Vui lòng nhập ${fieldLabel.toLowerCase()}`, severity: 'error' };
  }
  return null;
};

// ============================================================
// Full form validator
// ============================================================
export const validateForm = (values: FormValues, fields: FormField[]): ValidationError[] => {
  const errors: ValidationError[] = [];

  for (const field of fields) {
    if (!field.required && !values[field.id]) continue;

    const value = values[field.id] || '';

    // Required check
    if (field.required) {
      const reqErr = validateRequired(value, field.label);
      if (reqErr) {
        errors.push({ ...reqErr, field: field.id });
        continue;
      }
    }

    // Type-specific validation
    if (field.type === 'phone' && value) {
      const err = validatePhone(value);
      if (err) errors.push({ ...err, field: field.id });
    }

    if (field.type === 'date' && value) {
      const err = validateNgaySinh(value);
      if (err) errors.push({ ...err, field: field.id });
    }

    // Pattern validation
    if (field.validation?.pattern && value && !field.validation.pattern.test(value)) {
      errors.push({
        field: field.id,
        label: field.label,
        message: field.validation.message || `${field.label} không đúng định dạng`,
        severity: 'error',
      });
    }

    // CCCD-specific check
    if ((field.id.includes('cccd') || field.id.includes('Cccd')) && value) {
      const err = validateCCCD(value);
      if (err) errors.push({ ...err, field: field.id });
    }

    // Name validation for hoTen fields
    if ((field.id.includes('hoTen') || field.id.includes('Ten')) && field.type === 'text' && value) {
      const err = validateHoTen(value);
      if (err) errors.push({ ...err, field: field.id });
    }
  }

  return errors;
};

// ============================================================
// Quick validate a single value (for realtime feedback)
// ============================================================
export const quickValidate = (fieldId: string, value: string, _label: string): string | null => {
  if (fieldId.includes('cccd') || fieldId.includes('Cccd')) {
    return validateCCCD(value)?.message || null;
  }
  if (fieldId.includes('sdt') || fieldId === 'phone') {
    return validatePhone(value)?.message || null;
  }
  if (fieldId.includes('ngaySinh') || fieldId.includes('NgaySinh')) {
    return validateNgaySinh(value)?.message || null;
  }
  if (fieldId.includes('hoTen') || fieldId.includes('Ten')) {
    return validateHoTen(value)?.message || null;
  }
  return null;
};
