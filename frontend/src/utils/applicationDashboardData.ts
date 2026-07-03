import { normalizeOfficerApplication, type OfficerApplication } from './officerApplicationFilters';

export const DASHBOARD_STORAGE_KEY = 'officerApplications';

const RAW_INITIAL_APPLICATIONS = [
    {
        id: 'GOV-2026-000184',
        procedure: 'Xác nhận thông tin về cư trú',
        applicant: 'Nguyễn Văn An',
        citizenId: '042206001284',
        phone: '0912 345 678',
        email: 'nguyenvanan@example.com',
        submittedAt: '02/07/2026 09:18',
        dueDate: '05/07/2026',
        channel: 'Cổng dịch vụ công',
        status: 'Chờ tiếp nhận',
        documents: [
            { name: 'Tờ khai thay đổi thông tin cư trú.pdf', state: 'Đã có' },
            { name: 'Bản chụp Căn cước công dân.jpeg', state: 'Đã có' },
            { name: 'Giấy tờ chứng minh chỗ ở hợp pháp.docx', state: 'Cần kiểm tra' },
        ],
        attachments: [
            { id: 'mock-4', fileName: 'Tờ khai thay đổi thông tin cư trú.pdf', mimeType: 'application/pdf', size: 1024000, storageKey: 'mock-key-4', submittedAt: '02/07/2026' },
            { id: 'mock-5', fileName: 'Bản chụp Căn cước công dân.jpeg', mimeType: 'image/jpeg', size: 512000, storageKey: 'mock-key-5', submittedAt: '02/07/2026' },
            { id: 'mock-6', fileName: 'Giấy tờ chứng minh chỗ ở hợp pháp.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 2048000, storageKey: 'mock-key-6', submittedAt: '02/07/2026' },
        ],
    },
    {
        id: 'GOV-2026-000179',
        procedure: 'Đăng ký thường trú',
        applicant: 'Trần Thị Minh Hà',
        citizenId: '042301009152',
        phone: '0986 220 114',
        email: 'minhha@example.com',
        submittedAt: '02/07/2026 08:42',
        dueDate: '07/07/2026',
        channel: 'VNeID',
        status: 'Đang xử lí',
        documents: [
            { name: 'Tờ khai CT01', state: 'Đã có' },
            { name: 'Ý kiến chủ hộ', state: 'Đã có' },
        ],
    },
    {
        id: 'GOV-2026-000163',
        procedure: 'Đăng ký tạm trú',
        applicant: 'Lê Hoàng Nam',
        citizenId: '042199006874',
        phone: '0905 118 226',
        email: 'hoangnam@example.com',
        submittedAt: '01/07/2026 15:06',
        dueDate: '04/07/2026',
        channel: 'Cổng dịch vụ công',
        status: 'Chờ tiếp nhận',
        documents: [
            { name: 'Tờ khai CT01', state: 'Đã có' },
            { name: 'Hợp đồng thuê nhà', state: 'Cần kiểm tra' },
        ],
        attachments: [
            { id: 'mock-1', fileName: 'Tờ khai CT01', mimeType: 'application/pdf', size: 1024000, storageKey: 'mock-key-1', submittedAt: '02/07/2026' },
        ],
    },
    {
        id: 'GOV-2026-000151',
        procedure: 'Liên thông khai sinh, thường trú, BHYT',
        applicant: 'Phạm Thu Trang',
        citizenId: '042203003612',
        phone: '0934 441 906',
        email: 'thutrang@example.com',
        submittedAt: '01/07/2026 10:25',
        dueDate: '08/07/2026',
        channel: 'Cổng dịch vụ công',
        status: 'Đã tiếp nhận',
        documents: [
            { name: 'Tờ khai đăng ký khai sinh', state: 'Đã có' },
            { name: 'Tờ khai đăng ký cư trú', state: 'Đã có' },
            { name: 'Tờ khai tham gia BHYT', state: 'Đã có' },
        ],
        attachments: [
            { id: 'mock-2', fileName: 'Tờ khai đăng ký khai sinh', mimeType: 'application/pdf', size: 1536000, storageKey: 'mock-key-2', submittedAt: '01/07/2026' },
            { id: 'mock-3', fileName: 'Tờ khai đăng ký cư trú', mimeType: 'application/pdf', size: 850000, storageKey: 'mock-key-3', submittedAt: '01/07/2026' },
        ],
    },
];

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
