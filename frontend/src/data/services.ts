import { apiClient } from '../api/client';
import type { CCCDInfo, FormField, PublicService } from '../types';

interface ApiProcedureField extends Omit<FormField, 'cccdKey' | 'validation'> {
    cccdKey?: string;
    validation?: {
        pattern?: string;
        minLength?: number;
        maxLength?: number;
        message?: string;
    };
}

interface ApiProcedure extends Omit<PublicService, 'fields'> {
    fields: ApiProcedureField[];
}

export let PUBLIC_SERVICES: PublicService[] = [];
export let SERVICE_MAP: Record<string, PublicService> = {};
export let ROUTE_TO_SERVICE_MAP: Record<string, PublicService> = {};

let hasLoaded = false;
let loadingPromise: Promise<void> | null = null;

const cccdKeys = new Set<keyof CCCDInfo>([
    'id',
    'hoTen',
    'ngaySinh',
    'gioiTinh',
    'queQuan',
    'thuongTru',
    'ngayCap',
    'noiCap',
    'rawText',
]);

const toRegExp = (pattern?: string): RegExp | undefined => {
    if (!pattern) return undefined;

    try {
        return new RegExp(pattern);
    } catch {
        return undefined;
    }
};

const normalizeField = (field: ApiProcedureField): FormField => {
    const { cccdKey: rawCccdKey, validation: rawValidation, ...baseField } = field;
    const pattern = toRegExp(rawValidation?.pattern);
    const cccdKey =
        rawCccdKey && cccdKeys.has(rawCccdKey as keyof CCCDInfo) ? (rawCccdKey as keyof CCCDInfo) : undefined;
    const validation = rawValidation
        ? {
              ...(rawValidation.minLength !== undefined ? { minLength: rawValidation.minLength } : {}),
              ...(rawValidation.maxLength !== undefined ? { maxLength: rawValidation.maxLength } : {}),
              ...(rawValidation.message ? { message: rawValidation.message } : {}),
              ...(pattern ? { pattern } : {}),
          }
        : undefined;

    return {
        ...baseField,
        ...(cccdKey ? { cccdKey } : {}),
        ...(validation ? { validation } : {}),
    };
};

const normalizeProcedure = (procedure: ApiProcedure): PublicService => ({
    ...procedure,
    fields: procedure.fields.map(normalizeField),
});

const setPublicServices = (services: PublicService[]) => {
    PUBLIC_SERVICES = services;
    SERVICE_MAP = Object.fromEntries(services.map((service) => [service.id, service]));
    ROUTE_TO_SERVICE_MAP = Object.fromEntries(services.map((service) => [service.route, service]));
};

export const loadPublicServices = (): Promise<void> => {
    if (hasLoaded) return Promise.resolve();
    if (loadingPromise) return loadingPromise;

    loadingPromise = apiClient<ApiProcedure[]>('/v1/procedures?includeFields=true')
        .then((procedures) => {
            setPublicServices(procedures.map(normalizeProcedure));
            hasLoaded = true;
        })
        .catch((error: unknown) => {
            loadingPromise = null;
            throw error;
        });

    return loadingPromise;
};

export const findServiceByKeyword = (text: string): PublicService | null => {
    const lower = text.toLowerCase();
    for (const service of PUBLIC_SERVICES) {
        if (service.keywords.some((keyword) => lower.includes(keyword))) {
            return service;
        }
    }
    return null;
};
