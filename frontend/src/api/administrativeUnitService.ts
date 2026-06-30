import type { FormFieldOption } from '../types';

const ADMINISTRATIVE_API_BASE_URL = 'https://provinces.open-api.vn/api/v2';

interface AdministrativeProvince {
  code: number;
  name: string;
}

interface AdministrativeWard {
  code: number;
  name: string;
}

interface ProvinceDetail extends AdministrativeProvince {
  wards: AdministrativeWard[];
}

const getJson = async <T>(path: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(`${ADMINISTRATIVE_API_BASE_URL}${path}`, { signal });

  if (!response.ok) {
    throw new Error(`Không thể tải danh mục hành chính (${response.status}).`);
  }

  return response.json() as Promise<T>;
};

const toOption = (unit: AdministrativeProvince | AdministrativeWard): FormFieldOption => ({
  value: String(unit.code),
  label: unit.name.replace(/\s+/g, ' ').trim(),
});

export const administrativeUnitService = {
  async getProvinces(signal?: AbortSignal): Promise<FormFieldOption[]> {
    const provinces = await getJson<AdministrativeProvince[]>('/p/', signal);
    return provinces.map(toOption);
  },

  async getWards(provinceCode: string, signal?: AbortSignal): Promise<FormFieldOption[]> {
    const province = await getJson<ProvinceDetail>(
      `/p/${encodeURIComponent(provinceCode)}?depth=2`,
      signal,
    );
    return province.wards.map(toOption);
  },
};
