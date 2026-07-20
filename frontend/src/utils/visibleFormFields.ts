export interface VisibleFieldEntry {
  id: string;
  label?: string;
}

export interface VisibleFieldGroup {
  sectionId?: string;
  sectionTitle?: string;
  fieldIds: string[];
  /** ID của section/group được coi là tiêu điểm chính của màn hình
   * (chiếm diện tích lớn nhất trong viewport). */
  isPrimaryFocus?: boolean;
}

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

/** Các selector để tìm thẻ cha bọc một nhóm field (section/fieldset/card). */
const SECTION_SELECTORS = [
  'fieldset',
  'section',
  '[data-section-id]',
  '[data-group-id]',
  '[role="group"]',
  '[role="region"]',
  '.form-section',
  '.form-group',
  '.form-step',
  '.upload-case',
  '.case-block',
  '.case-card',
];

const CHATBOT_CONTAINER_SELECTOR =
  '.chatbot-container, .chatbot-widget, .chatbot-call-overlay';

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

/**
 * Tìm thẻ section/group cha gần nhất bọc quanh element.
 * Trả về element tìm được hoặc null nếu không có.
 */
const findParentSection = (element: HTMLElement): HTMLElement | null => {
  for (const selector of SECTION_SELECTORS) {
    const parent = element.closest<HTMLElement>(selector);
    if (parent && !parent.closest(CHATBOT_CONTAINER_SELECTOR)) return parent;
  }
  return null;
};

/**
 * Lấy tiêu đề của một section/group element.
 * Ưu tiên: data-section-title > data-group-title > legend > h2 > h3 > h4 > aria-label
 */
const getSectionTitle = (section: HTMLElement): string | undefined => {
  const dataTitle =
    section.dataset.sectionTitle?.trim()
    || section.dataset.groupTitle?.trim()
    || section.dataset.title?.trim();
  if (dataTitle) return dataTitle;

  const legend = section.querySelector<HTMLElement>(':scope > legend');
  if (legend?.textContent?.trim()) return legend.textContent.trim().slice(0, 200);

  for (const heading of ['h2', 'h3', 'h4', 'h5']) {
    const el = section.querySelector<HTMLElement>(`:scope > ${heading}, :scope > * > ${heading}`);
    if (el?.textContent?.trim()) return el.textContent.trim().slice(0, 200);
  }

  const ariaLabel = section.getAttribute('aria-label')?.trim();
  if (ariaLabel) return ariaLabel.slice(0, 200);

  const ariaLabelledby = section.getAttribute('aria-labelledby');
  if (ariaLabelledby) {
    const labelEl = document.getElementById(ariaLabelledby);
    if (labelEl?.textContent?.trim()) return labelEl.textContent.trim().slice(0, 200);
  }

  return undefined;
};

/**
 * Tính "điểm trung tâm" của một section trong viewport.
 * Section nào có trung điểm gần giữa màn hình nhất & chiếm diện tích lớn nhất
 * sẽ được coi là tiêu điểm chính (primary focus).
 */
const getPrimaryFocusSectionKey = (
  sectionMap: Map<HTMLElement | null, ReadonlySet<string>>,
): HTMLElement | null => {
  const viewportCenterY = window.innerHeight / 2;
  let bestSection: HTMLElement | null = null;
  let bestScore = -Infinity;

  for (const section of sectionMap.keys()) {
    if (!section) continue;
    const rect = section.getBoundingClientRect();
    if (rect.height === 0 || rect.width === 0) continue;

    // Phần diện tích của section nằm trong viewport
    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, window.innerHeight);
    const visibleHeight = Math.max(visibleBottom - visibleTop, 0);
    const visibleArea = visibleHeight * rect.width;

    // Điểm trung tâm của phần visible của section
    const sectionCenterY = (visibleTop + visibleBottom) / 2;
    const distFromCenter = Math.abs(sectionCenterY - viewportCenterY);

    // Score: ưu tiên diện tích lớn, gần trung tâm màn hình
    const score = visibleArea - distFromCenter * 2;

    if (score > bestScore) {
      bestScore = score;
      bestSection = section;
    }
  }
  return bestSection;
};

/**
 * Thu thập danh sách field đang hiển thị trên màn hình, nhóm theo section/khu vực.
 *
 * Thay vì trả về danh sách ID phẳng, hàm này trả về cấu trúc phân tầng:
 * mỗi nhóm có tên khu vực (sectionTitle), danh sách fieldIds bên trong,
 * và cờ isPrimaryFocus đánh dấu khu vực đang được người dùng tập trung vào.
 */
export const collectVisibleFieldGroups = (): VisibleFieldGroup[] => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return [];

  const controls = document.querySelectorAll<HTMLElement>(FORM_CONTROL_SELECTOR);
  // Map: section element (hoặc null = không có section) -> Set<fieldId>
  const sectionMap = new Map<HTMLElement | null, Set<string>>();
  const sectionOrder: (HTMLElement | null)[] = [];

  let totalFields = 0;
  const MAX_TOTAL_FIELDS = 50;

  for (const control of controls) {
    if (control.closest(CHATBOT_CONTAINER_SELECTOR)) continue;
    if (control instanceof HTMLInputElement && IGNORED_INPUT_TYPES.has(control.type)) continue;
    if (!isVisibleInViewport(control)) continue;

    const fieldId = getFieldId(control);
    if (!fieldId) continue;

    const section = findParentSection(control);

    if (!sectionMap.has(section)) {
      sectionMap.set(section, new Set());
      sectionOrder.push(section);
    }

    const fieldSet = sectionMap.get(section)!;
    if (!fieldSet.has(fieldId)) {
      fieldSet.add(fieldId.slice(0, 100));
      totalFields += 1;
    }

    if (totalFields >= MAX_TOTAL_FIELDS) break;
  }

  if (sectionMap.size === 0) return [];

  const primarySection = getPrimaryFocusSectionKey(sectionMap);

  const groups: VisibleFieldGroup[] = sectionOrder.map((section) => {
    const fieldIds = [...(sectionMap.get(section) ?? [])];
    if (section === null) {
      // Field không thuộc section nào - nhóm "ungrouped"
      return { fieldIds };
    }

    const sectionId = (
      section.dataset.sectionId?.trim()
      || section.dataset.groupId?.trim()
      || section.id?.trim()
    ) || undefined;

    const sectionTitle = getSectionTitle(section);

    return {
      ...(sectionId ? { sectionId } : {}),
      ...(sectionTitle ? { sectionTitle } : {}),
      fieldIds,
      isPrimaryFocus: section === primarySection,
    };
  });

  return groups;
};

/**
 * @deprecated Dùng collectVisibleFieldGroups() thay thế để có cấu trúc phân tầng.
 * Hàm này giữ lại để backward compatibility.
 */
export const collectVisibleFormFieldIds = (): string[] =>
  collectVisibleFieldGroups().flatMap((group) => group.fieldIds);
