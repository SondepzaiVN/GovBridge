import type { CCCDInfo, FormFieldOption } from '../types';

export interface ResidenceAdministrativeOption {
  value: string;
  label: string;
}

export interface ResolvedCccdResidenceAddress {
  rawAddress: string;
  province: ResidenceAdministrativeOption;
  ward: ResidenceAdministrativeOption | null;
  detailAddress: string;
}

export interface ResidenceFieldSuggestion {
  id: string;
  title: string;
  description: string;
  fields: Record<string, string>;
  fieldLabels: Record<string, string>;
  displayValues?: Record<string, string>;
}

const ADMIN_PREFIX_PATTERN =
  /\b(thanh pho|tp|tinh|quan|huyen|thi xa|thi tran|phuong|xa|dac khu|tx|tt|p)\b/gu;

export const toResidenceOptionsFromLabels = (labels: string[]): ResidenceAdministrativeOption[] =>
  labels.map((label) => ({ value: label, label }));

export const normalizeAdministrativeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gu, 'd')
    .replace(/Đ/gu, 'D')
    .toLocaleLowerCase('vi-VN')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

const stripAdministrativePrefix = (value: string): string =>
  normalizeAdministrativeText(value)
    .replace(ADMIN_PREFIX_PATTERN, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

const scoreOption = (address: string, option: ResidenceAdministrativeOption): number => {
  const normalizedLabel = normalizeAdministrativeText(option.label);
  const normalizedCore = stripAdministrativePrefix(option.label);
  if (normalizedLabel && address.includes(normalizedLabel)) return normalizedLabel.length + 100;
  if (normalizedCore.length >= 3 && address.includes(normalizedCore)) return normalizedCore.length;
  return 0;
};

const findBestOption = (
  address: string,
  options: ResidenceAdministrativeOption[],
): ResidenceAdministrativeOption | null => {
  let best: { option: ResidenceAdministrativeOption; score: number } | null = null;
  for (const option of options) {
    const score = scoreOption(address, option);
    if (score > 0 && (!best || score > best.score)) best = { option, score };
  }
  return best?.option ?? null;
};

const containsAdministrativeOption = (part: string, option: ResidenceAdministrativeOption | null): boolean => {
  if (!option) return false;
  const normalizedPart = normalizeAdministrativeText(part);
  const normalizedLabel = normalizeAdministrativeText(option.label);
  const normalizedCore = stripAdministrativePrefix(option.label);
  return Boolean(
    normalizedLabel && normalizedPart.includes(normalizedLabel)
    || normalizedCore.length >= 3 && normalizedPart.includes(normalizedCore),
  );
};

const extractDetailAddress = (
  rawAddress: string,
  province: ResidenceAdministrativeOption,
  ward: ResidenceAdministrativeOption | null,
): string => {
  const parts = rawAddress
    .split(/[,;\n]+/gu)
    .map((part) => part.replace(/\s+/gu, ' ').trim())
    .filter(Boolean);

  const detailParts = parts.filter((part) =>
    !containsAdministrativeOption(part, province) && !containsAdministrativeOption(part, ward)
  );

  return detailParts.join(', ');
};

export const resolveCccdResidenceAddress = async (
  info: CCCDInfo,
  provinceOptions: ResidenceAdministrativeOption[],
  getWardOptions: (provinceValue: string) => Promise<ResidenceAdministrativeOption[]>,
): Promise<ResolvedCccdResidenceAddress | null> => {
  const rawAddress = (info.thuongTru || '').replace(/\s+/gu, ' ').trim();
  if (!rawAddress) return null;

  const normalizedAddress = normalizeAdministrativeText(rawAddress);
  const province = findBestOption(normalizedAddress, provinceOptions);
  if (!province) return null;

  const wardOptions = await getWardOptions(province.value);
  const ward = findBestOption(normalizedAddress, wardOptions);

  return {
    rawAddress,
    province,
    ward,
    detailAddress: extractDetailAddress(rawAddress, province, ward),
  };
};

export const getOptionLabel = (
  options: Array<FormFieldOption | ResidenceAdministrativeOption>,
  value: string,
): string => options.find((option) => option.value === value)?.label || '';
