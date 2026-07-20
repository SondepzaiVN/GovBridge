export const FORM_FILL_APPLIED_EVENT = 'govbridge:form-fill-applied';

export interface FormFillAppliedDetail {
  fields: Record<string, string>;
  source: 'initial' | 'reconcile';
}

export const dispatchFormFillApplied = (
  fields: Record<string, string>,
  source: FormFillAppliedDetail['source'] = 'initial',
) => {
  if (typeof window === 'undefined' || Object.keys(fields).length === 0) return;
  window.dispatchEvent(
    new CustomEvent<FormFillAppliedDetail>(FORM_FILL_APPLIED_EVENT, {
      detail: { fields, source },
    }),
  );
};

export const addFormFillAppliedListener = (
  handler: (detail: FormFillAppliedDetail) => void,
) => {
  if (typeof window === 'undefined') return () => undefined;

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<FormFillAppliedDetail>;
    if (!customEvent.detail?.fields) return;
    handler(customEvent.detail);
  };

  window.addEventListener(FORM_FILL_APPLIED_EVENT, listener);
  return () => window.removeEventListener(FORM_FILL_APPLIED_EVENT, listener);
};
