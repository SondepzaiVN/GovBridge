import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { FormValues, FormState } from '../types';

interface FormContextValue {
  formState: FormState;
  setFieldValue: (fieldId: string, value: string) => void;
  setFieldError: (fieldId: string, error: string) => void;
  touchField: (fieldId: string) => void;
  fillFields: (fields: Record<string, string>) => void;
  resetForm: () => void;
  setIsSubmitting: (v: boolean) => void;
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

export const FormProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [formState, setFormState] = useState<FormState>(loadInitialState);

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
    const updatedFieldIds = Object.keys(fields);
    setFormState((prev) => ({
      ...prev,
      values: { ...prev.values, ...fields },
      errors: {
        ...prev.errors,
        ...Object.fromEntries(updatedFieldIds.map((fieldId) => [fieldId, ''])),
      },
      touched: {
        ...prev.touched,
        ...Object.fromEntries(updatedFieldIds.map((fieldId) => [fieldId, true])),
      },
    }));
  }, []);

  const resetForm = useCallback(() => {
    setFormState(initialFormState);
  }, []);

  const setIsSubmitting = useCallback((v: boolean) => {
    setFormState((prev) => ({ ...prev, isSubmitting: v }));
  }, []);

  return (
    <FormContext.Provider value={{
      formState, setFieldValue, setFieldError, touchField,
      fillFields, resetForm, setIsSubmitting,
    }}>
      {children}
    </FormContext.Provider>
  );
};

export const useForm = () => {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error('useForm must be used within FormProvider');
  return ctx;
};

// Optional: standalone hook for form with values
export const useFormValues = (): FormValues => {
  const { formState } = useForm();
  return formState.values;
};
