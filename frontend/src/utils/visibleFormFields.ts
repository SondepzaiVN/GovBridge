const FORM_CONTROL_SELECTOR = [
  '[data-field-id]',
  'input[id]',
  'input[name]',
  'select[id]',
  'select[name]',
  'button[id][data-select-options]',
  'textarea[id]',
  'textarea[name]',
].join(',');

const IGNORED_INPUT_TYPES = new Set([
  'button',
  'file',
  'hidden',
  'image',
  'reset',
  'submit',
]);

const isVisibleInViewport = (element: HTMLElement): boolean => {
  if (element.closest('[hidden], [aria-hidden="true"]')) return false;

  const style = window.getComputedStyle(element);
  if (
    style.display === 'none'
    || style.visibility === 'hidden'
    || style.visibility === 'collapse'
    || Number(style.opacity) === 0
  ) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return (
    rect.width > 0
    && rect.height > 0
    && rect.bottom > 0
    && rect.right > 0
    && rect.top < window.innerHeight
    && rect.left < window.innerWidth
  );
};

const getFieldId = (element: HTMLElement): string => {
  const dataFieldId = element.dataset.fieldId?.trim();
  if (dataFieldId) return dataFieldId;

  if (
    element instanceof HTMLInputElement
    && (element.type === 'radio' || element.type === 'checkbox')
    && element.name.trim()
  ) {
    return element.name.trim();
  }

  return element.id.trim() || element.getAttribute('name')?.trim() || '';
};

export const collectVisibleFormFieldIds = (): string[] => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return [];

  const fieldIds = new Set<string>();
  const controls = document.querySelectorAll<HTMLElement>(FORM_CONTROL_SELECTOR);

  for (const control of controls) {
    if (control.closest('.chatbot-container, .chatbot-widget, .chatbot-call-overlay')) continue;
    if (control instanceof HTMLInputElement && IGNORED_INPUT_TYPES.has(control.type)) continue;
    if (!isVisibleInViewport(control)) continue;

    const fieldId = getFieldId(control);
    if (fieldId) fieldIds.add(fieldId.slice(0, 100));
    if (fieldIds.size >= 50) break;
  }

  return [...fieldIds];
};
