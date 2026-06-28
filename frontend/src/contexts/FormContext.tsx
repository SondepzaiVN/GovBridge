import React, { createContext, useContext, useState, useCallback } from 'react';
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

export const FormProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [formState, setFormState] = useState<FormState>(initialFormState);

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
    setFormState((prev) => ({
      ...prev,
      values: { ...prev.values, ...fields },
      touched: {
        ...prev.touched,
        ...Object.fromEntries(Object.keys(fields).map((k) => [k, true])),
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
