import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { AssistantPageContext, FormValues, FormState } from '../types';
import { dispatchFormFillApplied } from '../utils/formFillBridge';

interface FormContextValue {
  formState: FormState;
  pageContext: AssistantPageContext | null;
  setFieldValue: (fieldId: string, value: string) => void;
  setFieldError: (fieldId: string, error: string) => void;
  touchField: (fieldId: string) => void;
  fillFields: (fields: Record<string, string>) => void;
  resetForm: () => void;
  setIsSubmitting: (v: boolean) => void;
  setPageContext: (context: AssistantPageContext | null) => void;
}

const FormContext = createContext<FormContextValue | null>(null);

const initialFormState: FormState = {
  values: {},
  errors: {},
  touched: {},
  isSubmitting: false,
};

const STORAGE_KEY = 'gov-bridge-form-state';

const loadInitialState = (): FormState => {
  if (typeof window === 'undefined') return initialFormState;
  try {
    const saved = window.sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return initialFormState;
    const parsed = JSON.parse(saved) as Partial<FormState>;
    return {
      values: parsed.values ?? {},
      errors: parsed.errors ?? {},
      touched: parsed.touched ?? {},
      isSubmitting: false,
    };
  } catch {
    return initialFormState;
  }
};

const normalizeOptionLabel = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN')
    .replace(/đ/g, 'd')
    .replace(/\b(?:tinh|thanh pho|phuong|xa|thi tran|dac khu)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const getOptionLookupKeys = (value: string): string[] => {
  const normalizedValue = normalizeOptionLabel(value);
  const trailingValue = normalizedValue
    .split(/\b(?:la|tai|o)\b/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1);
  return [...new Set([normalizedValue, trailingValue].filter(Boolean) as string[])];
};

const resolveRenderedSelectValue = (
  fieldId: string,
  value: string,
): { isSelect: boolean; resolvedValue: string | null } => {
  if (typeof document === 'undefined') return { isSelect: false, resolvedValue: null };
  const control = document.getElementById(fieldId);
  if (!control) {
    return { isSelect: false, resolvedValue: null };
  }

  if (control instanceof HTMLSelectElement) {
    const options = [...control.options].filter((option) => option.value);
    const directMatch = options.find((option) => option.value === value);
    if (directMatch) return { isSelect: true, resolvedValue: directMatch.value };

    const lookupKeys = getOptionLookupKeys(value);
    const labelMatch = options.find(
      (option) => lookupKeys.includes(normalizeOptionLabel(option.label)),
    );
    return {
      isSelect: true,
      resolvedValue: labelMatch?.value ?? null,
    };
  }

  const renderedOptions = control.dataset.selectOptions;
  if (!renderedOptions) return { isSelect: false, resolvedValue: null };

  let options: string[] = [];
  try {
    const parsed = JSON.parse(renderedOptions);
    if (Array.isArray(parsed)) {
      options = parsed.filter((option): option is string => typeof option === 'string' && option.trim().length > 0);
    }
  } catch {
    options = [];
  }

  const directMatch = options.find((option) => option === value);
  if (directMatch) return { isSelect: true, resolvedValue: directMatch };

  const lookupKeys = getOptionLookupKeys(value);
  const labelMatch = options.find((option) => lookupKeys.includes(normalizeOptionLabel(option)));
  return {
    isSelect: true,
    resolvedValue: labelMatch ?? null,
  };
};

export const FormProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [formState, setFormState] = useState<FormState>(loadInitialState);
  const [pageContext, setPageContext] = useState<AssistantPageContext | null>(null);

  useEffect(() => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        values: formState.values,
        errors: formState.errors,
        touched: formState.touched,
      }),
    );
  }, [formState.values, formState.errors, formState.touched]);

  const setFieldValue = useCallback((fieldId: string, value: string) => {
    setFormState((prev) => ({
      ...prev,
      values: { ...prev.values, [fieldId]: value },
      // Clear error when user types
      errors: { ...prev.errors, [fieldId]: '' },
    }));
  }, []);

  const setFieldError = useCallback((fieldId: string, error: string) => {
    setFormState((prev) => ({
      ...prev,
      errors: { ...prev.errors, [fieldId]: error },
    }));
  }, []);

  const touchField = useCallback((fieldId: string) => {
    setFormState((prev) => ({
      ...prev,
      touched: { ...prev.touched, [fieldId]: true },
    }));
  }, []);

  // Called by chatbot to auto-fill form fields
  const fillFields = useCallback((fields: Record<string, string>) => {
    const preparedFields: Record<string, string> = {};
    const pendingSelectFields: Record<string, string> = {};

    Object.entries(fields).forEach(([fieldId, value]) => {
      const resolution = resolveRenderedSelectValue(fieldId, value);
      preparedFields[fieldId] = resolution.resolvedValue ?? value;
      if (resolution.isSelect && !resolution.resolvedValue) {
        pendingSelectFields[fieldId] = value;
      }
    });

    const updatedFieldIds = Object.keys(preparedFields);
    setFormState((prev) => ({
      ...prev,
      values: { ...prev.values, ...preparedFields },
      errors: {
        ...prev.errors,
        ...Object.fromEntries(updatedFieldIds.map((fieldId) => [fieldId, ''])),
      },
      touched: {
        ...prev.touched,
        ...Object.fromEntries(updatedFieldIds.map((fieldId) => [fieldId, true])),
      },
    }));
    dispatchFormFillApplied(preparedFields, 'initial');

    // Select phụ thuộc (phường/xã) chỉ có options sau khi tỉnh/thành phố được điền.
    // Thử đối chiếu lại trong vài giây để lấy đúng mã option từ danh mục động.
    if (typeof window !== 'undefined' && Object.keys(pendingSelectFields).length > 0) {
      const deadline = Date.now() + 5_000;
      const reconcilePendingSelects = () => {
        const resolvedFields: Record<string, string> = {};

        Object.entries(pendingSelectFields).forEach(([fieldId, value]) => {
          const resolution = resolveRenderedSelectValue(fieldId, value);
          if (!resolution.resolvedValue) return;
          resolvedFields[fieldId] = resolution.resolvedValue;
          delete pendingSelectFields[fieldId];
        });

        if (Object.keys(resolvedFields).length > 0) {
          setFormState((prev) => ({
            ...prev,
            values: { ...prev.values, ...resolvedFields },
          }));
          dispatchFormFillApplied(resolvedFields, 'reconcile');
        }

        if (Object.keys(pendingSelectFields).length > 0 && Date.now() < deadline) {
          window.setTimeout(reconcilePendingSelects, 100);
        }
      };

      window.setTimeout(reconcilePendingSelects, 100);
    }
  }, []);

  const resetForm = useCallback(() => {
    setFormState(initialFormState);
  }, []);

  const setIsSubmitting = useCallback((v: boolean) => {
    setFormState((prev) => ({ ...prev, isSubmitting: v }));
  }, []);

  return (
    <FormContext.Provider value={{
      formState, pageContext, setFieldValue, setFieldError, touchField,
      fillFields, resetForm, setIsSubmitting, setPageContext,
    }}>
      {children}
    </FormContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useForm = () => {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error('useForm must be used within FormProvider');
  return ctx;
};

// Optional: standalone hook for form with values
// eslint-disable-next-line react-refresh/only-export-components
export const useFormValues = (): FormValues => {
  const { formState } = useForm();
  return formState.values;
};
