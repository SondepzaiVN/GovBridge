import { normalizeOfficerApplication, type OfficerApplication } from './officerApplicationFilters';

export const DASHBOARD_STORAGE_KEY = 'officerApplications_v2';

const RAW_INITIAL_APPLICATIONS: unknown[] = [];

export const INITIAL_DASHBOARD_APPLICATIONS: OfficerApplication[] = RAW_INITIAL_APPLICATIONS.map(
    (application, index) => normalizeOfficerApplication(application, `GOV-MOCK-${index + 1}`),
);

export const loadDashboardApplications = (): OfficerApplication[] => {
    try {
        const stored = window.localStorage.getItem(DASHBOARD_STORAGE_KEY);
        if (!stored) return INITIAL_DASHBOARD_APPLICATIONS;
        const parsed: unknown = JSON.parse(stored);
        if (!Array.isArray(parsed)) return INITIAL_DASHBOARD_APPLICATIONS;
        const normalized = parsed.map((application, index) => (
            normalizeOfficerApplication(application, `GOV-LOCAL-${index + 1}`)
        ));
        const storedIds = new Set(normalized.map((application) => application.id));
        return [
            ...normalized,
            ...INITIAL_DASHBOARD_APPLICATIONS.filter((application) => !storedIds.has(application.id)),
        ];
    } catch {
        return INITIAL_DASHBOARD_APPLICATIONS;
    }
};
