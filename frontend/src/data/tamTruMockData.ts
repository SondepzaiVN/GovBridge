export const procedureTypes = [
    { value: 'dang-ky-tam-tru', label: 'Đăng ký tạm trú' },
    { value: 'gia-han-tam-tru', label: 'Gia hạn tạm trú' },
    { value: 'dieu-chinh-tam-tru', label: 'Điều chỉnh thông tin tạm trú' },
];

export const procedureCasesByType: Record<string, Array<{ value: string; label: string }>> = {
    'dang-ky-tam-tru': [
        { value: 'nhan-khau-ho', label: 'Đăng ký tạm trú (nhân khẩu, hộ)' },
        { value: 'dang-ky-moi', label: 'Đăng ký tạm trú mới' },
        { value: 'lap-ho-moi', label: 'Đăng ký tạm trú lập hộ mới' },
        { value: 'vao-ho-da-co', label: 'Đăng ký tạm trú vào hộ đã có' },
    ],
    'gia-han-tam-tru': [{ value: 'gia-han', label: 'Gia hạn tạm trú' }],
    'dieu-chinh-tam-tru': [{ value: 'dieu-chinh', label: 'Điều chỉnh thông tin tạm trú' }],
};

export const dateFormatOptions = [
    { value: 'day-month-year', label: 'Ngày tháng năm' },
    { value: 'month-year', label: 'Tháng năm' },
    { value: 'year', label: 'Năm' },
];

export const genderOptions = ['Nam', 'Nữ', 'Khác'];
export const ethnicityOptions = ['Kinh', 'Hoa', 'Khmer', 'Tày', 'Thái', 'Khác'];
export const religionOptions = ['Không', 'Phật giáo', 'Công giáo', 'Tin lành', 'Khác'];
export const relationshipOptions = ['Chủ hộ', 'Vợ/chồng', 'Con', 'Cha/mẹ', 'Người thuê', 'Người ở nhờ', 'Người thân khác'];

export const resultMethods = [
    { value: 'truc-tiep', label: 'Nhận trực tiếp' },
    { value: 'buu-chinh', label: 'Nhận qua bưu chính' },
    { value: 'truc-tuyen', label: 'Nhận trực tuyến' },
];

export const notificationMethods = [
    { value: 'portal', label: 'Nhận qua cổng thông tin' },
    { value: 'email', label: 'Nhận qua email' },
    { value: 'sms', label: 'Nhận qua SMS' },
];

export interface TamTruDossierDocument {
    id: string;
    name: string;
    kind: string;
    required: boolean;
    quantity: string;
}

export interface TamTruDossierCase {
    id: string;
    title: string;
    documents: TamTruDossierDocument[];
}

const ct01 = {
    id: 'ct01',
    name: 'Tờ khai thay đổi thông tin cư trú (CT01)',
    kind: 'Bản gốc',
    required: true,
    quantity: '1',
};

const residenceProof = {
    id: 'residence-proof',
    name: 'Giấy tờ, tài liệu chứng minh chỗ ở hợp pháp',
    kind: 'Bản chụp',
    required: true,
    quantity: '1',
};

export const dossierCases: TamTruDossierCase[] = [
    {
        id: 'owned-legal-place',
        title: 'Đăng ký tạm trú tại chỗ ở hợp pháp thuộc quyền sở hữu của mình',
        documents: [ct01, residenceProof],
    },
    {
        id: 'owner-consent',
        title: 'Đăng ký tạm trú tại chỗ ở hợp pháp không thuộc quyền sở hữu của mình khi được chủ hộ tạm trú và chủ sở hữu chỗ ở hợp pháp đó đồng ý',
        documents: [
            ct01,
            residenceProof,
            {
                id: 'owner-consent-doc',
                name: 'Văn bản đồng ý của chủ hộ/chủ sở hữu chỗ ở hợp pháp',
                kind: 'Bản chụp',
                required: true,
                quantity: '1',
            },
        ],
    },
    {
        id: 'rent-borrow-stay',
        title: 'Đăng ký tạm trú tại chỗ ở hợp pháp do thuê, mượn, ở nhờ',
        documents: [
            ct01,
            residenceProof,
            {
                id: 'rental-contract',
                name: 'Hợp đồng thuê nhà hoặc văn bản cho ở nhờ',
                kind: 'Bản chụp',
                required: true,
                quantity: '1',
            },
            {
                id: 'householder-consent',
                name: 'Văn bản đồng ý của chủ hộ/chủ sở hữu chỗ ở hợp pháp',
                kind: 'Bản chụp',
                required: true,
                quantity: '1',
            },
        ],
    },
    {
        id: 'armed-force-unit',
        title: 'Đăng ký tạm trú tại nơi đơn vị đóng quân trong Công an nhân dân hoặc Quân đội nhân dân',
        documents: [ct01, residenceProof],
    },
    {
        id: 'mobile-vehicle',
        title: 'Đăng ký tạm trú tại phương tiện đối với người sinh sống, người làm nghề lưu động trên phương tiện thuộc quyền sở hữu của mình',
        documents: [ct01, residenceProof],
    },
];

export const fieldHelp: Record<string, string> = {
    procedureTypeCode: 'Chọn loại thủ tục phù hợp: đăng ký mới, gia hạn hoặc điều chỉnh thông tin tạm trú.',
    procedureCaseCode: 'Trường hợp giúp hệ thống xác định thành phần hồ sơ cần nộp.',
    citizenId: 'Số định danh cá nhân là số CCCD 12 chữ số.',
    householderRelationship: 'Chọn quan hệ thực tế với chủ hộ tạm trú.',
    dossier: 'Giấy tờ chứng minh chỗ ở có thể là giấy tờ sở hữu nhà, hợp đồng thuê nhà hoặc xác nhận cho ở nhờ.',
    temporaryUntilDate: 'Thời hạn tạm trú không nên vượt quá 2 năm trong bản demo.',
    fee: 'Lệ phí demo mặc định là 7.000 VND, có thể chuyển sang miễn phí nếu có lý do.',
};
