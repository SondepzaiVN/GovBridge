import { normalizeOfficerApplication, type OfficerApplication } from './officerApplicationFilters';

export const DASHBOARD_STORAGE_KEY = 'officerApplications_v2';

const RAW_INITIAL_APPLICATIONS: unknown[] = [];

export const INITIAL_DASHBOARD_APPLICATIONS: OfficerApplication[] = RAW_INITIAL_APPLICATIONS.map(
    (application, index) => normalizeOfficerApplication(application, `GOV-MOCK-${index + 1}`),
);

export const fetchDashboardApplications = async (): Promise<OfficerApplication[]> => {
    try {
        const response = await fetch('/api/v1/dashboard/applications');
        if (!response.ok) return INITIAL_DASHBOARD_APPLICATIONS;
        
        const data = await response.json();
        if (!data.success || !Array.isArray(data.data)) {
            return INITIAL_DASHBOARD_APPLICATIONS;
        }

        const normalized = data.data.map((application: unknown, index: number) => (
            normalizeOfficerApplication(application, `GOV-API-${index + 1}`)
        ));
        
        const storedIds = new Set(normalized.map((application: OfficerApplication) => application.id));
        return [
            ...normalized,
            ...INITIAL_DASHBOARD_APPLICATIONS.filter((application) => !storedIds.has(application.id)),
        ];
    } catch (e) {
        console.error('Failed to fetch dashboard applications', e);
        return INITIAL_DASHBOARD_APPLICATIONS;
    }
};
