import type { FormField, FormFieldOption } from '../../types';

export interface FamilyMember {
  id: number;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  citizenId: string;
  relationshipWithHouseholder: string;
}

export interface OverseasStayRow {
  id: number;
  fromDate: string;
  toDate: string;
  residenceAddress: string;
  occupation: string;
}

export interface OverseasFamilyMember {
  id: number;
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  relationship: string;
  occupation: string;
  currentAddress: string;
}

export interface ResidenceDocumentRequirement {
  id: string;
  name: string;
  required: boolean;
  kindOptions?: string[];
  defaultKind?: string;
  templateAvailable?: boolean;
  canUseSpecializedData?: boolean;
  guidance?: string;
}

export interface ResidenceDocumentCase {
  id: string;
  title: string;
  requirements: ResidenceDocumentRequirement[];
}

export const GENDER_OPTIONS = ['Nam', 'Nữ', 'Khác'];

export const HOUSEHOLD_RELATIONSHIP_OPTIONS = [
  'Vợ',
  'Chồng',
  'Con đẻ',
  'Con nuôi',
  'Cha',
  'Mẹ',
  'Ông',
  'Bà',
  'Anh',
  'Chị',
  'Em',
  'Cháu ruột',
  'Người ở nhờ',
  'Khác',
];

export const NATIONALITY_OPTIONS = [
  'Việt Nam',
  'Hoa Kỳ',
  'Canada',
  'Úc',
  'Hàn Quốc',
  'Nhật Bản',
  'Singapore',
  'Khác',
];

const BASE_FILE_KINDS = ['Bản gốc', 'Bản sao', 'Bản chụp'];

const createCommonDeclarationDoc = (isOverseasDossier: boolean): ResidenceDocumentRequirement => ({
  id: isOverseasDossier ? 'ct02' : 'ct01',
  name: isOverseasDossier
    ? 'Tờ khai thay đổi thông tin cư trú (CT02)'
    : 'Tờ khai thay đổi thông tin cư trú (CT01)',
  required: true,
  kindOptions: BASE_FILE_KINDS,
  defaultKind: 'Bản gốc',
  templateAvailable: true,
  canUseSpecializedData: false,
  guidance: isOverseasDossier
    ? 'Dùng cho luồng công dân Việt Nam định cư ở nước ngoài.'
    : 'Biểu mẫu kê khai cư trú bắt buộc trong hầu hết trường hợp.',
});

const createHousingProofDoc = (): ResidenceDocumentRequirement => ({
  id: 'housing-proof',
  name: 'Giấy tờ, tài liệu chứng minh chỗ ở hợp pháp',
  required: true,
  kindOptions: BASE_FILE_KINDS,
  defaultKind: 'Bản chụp',
  templateAvailable: false,
  canUseSpecializedData: true,
  guidance: 'Sổ đỏ, giấy chứng nhận quyền sở hữu nhà ở, hợp đồng mua bán hoặc giấy tờ tương đương.',
});

export const getResidenceDocumentCases = ({
  isOverseasDossier,
}: {
  isNewHousehold: boolean;
  isOverseasDossier: boolean;
}): ResidenceDocumentCase[] => {
  const declarationDoc = createCommonDeclarationDoc(isOverseasDossier);

  const cases: ResidenceDocumentCase[] = [
    ...(isOverseasDossier
      ? [{
        id: 'overseas-vietnamese',
        title: 'Công dân Việt Nam định cư ở nước ngoài không có hộ chiếu Việt Nam còn giá trị sử dụng',
        requirements: [
          declarationDoc,
          {
            id: 'travel-document',
            name: 'Hộ chiếu nước ngoài/giấy tờ đi lại quốc tế hoặc giấy tờ do cơ quan có thẩm quyền Việt Nam cấp',
            required: true,
            kindOptions: BASE_FILE_KINDS,
            defaultKind: 'Bản chụp',
            templateAvailable: false,
            canUseSpecializedData: false,
            guidance: 'Bao gồm hộ chiếu nước ngoài, giấy thông hành hoặc giấy tờ chứng minh quốc tịch/hồi hương.',
          },
          {
            id: 'overseas-residence-proof',
            name: 'Giấy tờ chứng minh nơi cư trú trước khi nhập cảnh và thông tin định cư ở nước ngoài',
            required: true,
            kindOptions: BASE_FILE_KINDS,
            defaultKind: 'Bản chụp',
            templateAvailable: false,
            canUseSpecializedData: false,
            guidance: 'Ví dụ: thẻ cư trú, visa dài hạn, giấy xác nhận địa chỉ ở nước ngoài.',
          },
          createHousingProofDoc(),
        ],
      }]
      : []),
    {
      id: 'military-unit',
      title: 'Đăng ký thường trú tại nơi đơn vị đóng quân trong Quân đội nhân dân',
      requirements: [
        declarationDoc,
        {
          id: 'military-introduction',
          name: 'Giấy giới thiệu của thủ trưởng đơn vị quản lý trực tiếp ghi rõ nội dung làm thủ tục đăng ký thường trú',
          required: true,
          kindOptions: BASE_FILE_KINDS,
          defaultKind: 'Bản gốc',
          templateAvailable: false,
          canUseSpecializedData: false,
          guidance: 'Có ký tên, đóng dấu và xác nhận về chỗ ở do đơn vị quản lý.',
        },
      ],
    },
    {
      id: 'owned-house',
      title: 'Đăng ký thường trú vào chỗ ở hợp pháp thuộc quyền sở hữu của mình',
      requirements: [
        declarationDoc,
        createHousingProofDoc(),
      ],
    },
    {
      id: 'non-owned-consent',
      title: 'Đăng ký thường trú tại chỗ ở hợp pháp không thuộc quyền sở hữu của mình khi được chủ hộ và chủ sở hữu chỗ ở hợp pháp đó đồng ý',
      requirements: [
        declarationDoc,
        createHousingProofDoc(),
        {
          id: 'householder-consent',
          name: 'Văn bản đồng ý của chủ hộ và chủ sở hữu chỗ ở hợp pháp',
          required: true,
          kindOptions: BASE_FILE_KINDS,
          defaultKind: 'Bản chụp',
          templateAvailable: false,
          canUseSpecializedData: false,
          guidance: 'Có thể thay bằng xác nhận điện tử qua VNeID ở giai đoạn tích hợp sau.',
        },
        {
          id: 'relationship-proof',
          name: 'Giấy tờ chứng minh mối quan hệ hoặc căn cứ cho nhập khẩu',
          required: false,
          kindOptions: BASE_FILE_KINDS,
          defaultKind: 'Bản chụp',
          templateAvailable: false,
          canUseSpecializedData: false,
          guidance: 'Ví dụ: giấy khai sinh, đăng ký kết hôn, quyết định giám hộ hoặc văn bản thỏa thuận.',
        },
      ],
    },
    {
      id: 'rent-borrow-stay',
      title: 'Đăng ký thường trú tại chỗ ở hợp pháp do thuê, mượn, ở nhờ',
      requirements: [
        declarationDoc,
        {
          id: 'rent-contract',
          name: 'Hợp đồng thuê, mượn, ở nhờ hoặc văn bản thỏa thuận cho ở nhờ',
          required: true,
          kindOptions: BASE_FILE_KINDS,
          defaultKind: 'Bản chụp',
          templateAvailable: false,
          canUseSpecializedData: false,
          guidance: 'Nên có đầy đủ chữ ký của các bên liên quan.',
        },
        {
          id: 'area-proof',
          name: 'Tài liệu chứng minh điều kiện diện tích nhà ở theo quy định',
          required: false,
          kindOptions: BASE_FILE_KINDS,
          defaultKind: 'Bản chụp',
          templateAvailable: false,
          canUseSpecializedData: true,
          guidance: 'Ví dụ: thông tin nhà đất, sơ đồ diện tích hoặc xác nhận của địa phương/chủ sở hữu.',
        },
        {
          id: 'owner-consent-rent',
          name: 'Văn bản đồng ý của chủ hộ/chủ sở hữu chỗ ở hợp pháp',
          required: true,
          kindOptions: BASE_FILE_KINDS,
          defaultKind: 'Bản chụp',
          templateAvailable: false,
          canUseSpecializedData: false,
          guidance: 'Áp dụng khi người đăng ký nhập thường trú tại địa chỉ đi thuê, mượn hoặc ở nhờ.',
        },
      ],
    },
    {
      id: 'religious-facility',
      title: 'Đăng ký thường trú tại cơ sở tín ngưỡng, cơ sở tôn giáo có công trình phụ trợ là nhà ở',
      requirements: [
        declarationDoc,
        {
          id: 'religious-confirmation',
          name: 'Văn bản xác nhận của người đứng đầu cơ sở tín ngưỡng, cơ sở tôn giáo',
          required: true,
          kindOptions: BASE_FILE_KINDS,
          defaultKind: 'Bản gốc',
          templateAvailable: false,
          canUseSpecializedData: false,
          guidance: 'Xác nhận việc quản lý, bố trí chỗ ở và sự đồng ý cho đăng ký thường trú.',
        },
        {
          id: 'facility-legal-doc',
          name: 'Giấy tờ chứng minh cơ sở tín ngưỡng, tôn giáo có công trình phụ trợ là nhà ở',
          required: true,
          kindOptions: BASE_FILE_KINDS,
          defaultKind: 'Bản chụp',
          templateAvailable: false,
          canUseSpecializedData: false,
          guidance: 'Có thể là quyết định thành lập, giấy phép hoạt động hoặc giấy tờ sở hữu công trình.',
        },
      ],
    },
    {
      id: 'social-care',
      title: 'Người được chăm sóc, nuôi dưỡng, trợ giúp được đăng ký thường trú tại cơ sở trợ giúp xã hội hoặc được đăng ký thường trú vào hộ gia đình nhận chăm sóc, nuôi dưỡng, trợ giúp',
      requirements: [
        declarationDoc,
        {
          id: 'care-decision',
          name: 'Quyết định tiếp nhận, chăm sóc, nuôi dưỡng hoặc văn bản xác nhận của cơ sở trợ giúp xã hội',
          required: true,
          kindOptions: BASE_FILE_KINDS,
          defaultKind: 'Bản chụp',
          templateAvailable: false,
          canUseSpecializedData: false,
          guidance: 'Dùng để chứng minh căn cứ cư trú tại cơ sở hoặc tại hộ gia đình chăm sóc.',
        },
        {
          id: 'guardian-proof',
          name: 'Giấy tờ chứng minh quan hệ giám hộ/chăm sóc hoặc văn bản đồng ý của hộ gia đình nhận chăm sóc',
          required: true,
          kindOptions: BASE_FILE_KINDS,
          defaultKind: 'Bản chụp',
          templateAvailable: false,
          canUseSpecializedData: false,
          guidance: 'Ví dụ: quyết định giám hộ, cam kết nhận chăm sóc hoặc xác nhận của UBND cấp xã.',
        },
      ],
    },
    {
      id: 'police-unit',
      title: 'Đăng ký thường trú tại nơi đơn vị đóng quân trong Công an nhân dân',
      requirements: [
        declarationDoc,
        {
          id: 'police-introduction',
          name: 'Giấy giới thiệu/xác nhận của thủ trưởng đơn vị công an trực tiếp quản lý chỗ ở',
          required: true,
          kindOptions: BASE_FILE_KINDS,
          defaultKind: 'Bản gốc',
          templateAvailable: false,
          canUseSpecializedData: false,
          guidance: 'Nội dung cần ghi rõ việc đề nghị đăng ký thường trú và tình trạng chỗ ở được bố trí.',
        },
      ],
    },
    {
      id: 'vehicle-residence',
      title: 'Người sinh sống, người làm nghề lưu động trên phương tiện được đăng ký thường trú tại phương tiện',
      requirements: [
        declarationDoc,
        {
          id: 'vehicle-registration',
          name: 'Giấy đăng ký phương tiện hoặc giấy chứng nhận quyền sở hữu phương tiện',
          required: true,
          kindOptions: BASE_FILE_KINDS,
          defaultKind: 'Bản chụp',
          templateAvailable: false,
          canUseSpecializedData: false,
          guidance: 'Cần thể hiện rõ chủ sở hữu và đặc điểm phương tiện dùng làm nơi cư trú.',
        },
        {
          id: 'vehicle-route-confirmation',
          name: 'Xác nhận về địa điểm neo đậu, đỗ thường xuyên hoặc tuyến hoạt động ổn định',
          required: true,
          kindOptions: BASE_FILE_KINDS,
          defaultKind: 'Bản chụp',
          templateAvailable: false,
          canUseSpecializedData: false,
          guidance: 'Có thể do bến cảng, bến thủy nội địa, đơn vị quản lý hoặc UBND địa phương xác nhận.',
        },
      ],
    },
  ];

  return cases;
};

export const createBlankFamilyMember = (id: number): FamilyMember => ({
  id,
  fullName: '',
  dateOfBirth: '',
  gender: '',
  citizenId: '',
  relationshipWithHouseholder: '',
});

export const createBlankOverseasStayRow = (id: number): OverseasStayRow => ({
  id,
  fromDate: '',
  toDate: '',
  residenceAddress: '',
  occupation: '',
});

export const createBlankOverseasFamilyMember = (id: number): OverseasFamilyMember => ({
  id,
  fullName: '',
  dateOfBirth: '',
  nationality: '',
  relationship: '',
  occupation: '',
  currentAddress: '',
});

const namePattern = /^[^\d!@#$%^&*()_+=[\]{};':"\\|,.<>/?]+$/u;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const buildOptions = (labels: string[]): FormFieldOption[] =>
  labels.map((label) => ({ value: label, label }));

export const createSyntheticField = (field: FormField): FormField => field;

export const normalizeDigits = (value: string): string => value.replace(/\D/g, '');

export const isValidCitizenId = (value: string, allowedLengths: number[] = [12]): boolean => {
  const digits = normalizeDigits(value);
  return allowedLengths.some((length) => digits.length === length);
};

export const isValidEmail = (value: string): boolean =>
  !value.trim() || emailPattern.test(value.trim());

export const isValidVietnamesePhone = (value: string): boolean => {
  const normalized = value.trim().replace(/[\s.()-]/g, '');
  const converted = normalized.startsWith('+84') ? `0${normalized.slice(3)}` : normalized;
  return /^(0[3-9]\d{8})$/.test(converted);
};

export const isValidAgencyPhone = (value: string): boolean => {
  const normalized = value.trim().replace(/[\s.()-]/g, '');
  const converted = normalized.startsWith('+84') ? `0${normalized.slice(3)}` : normalized;
  return /^(0\d{9,10})$/.test(converted);
};

export const isFutureDate = (value: string): boolean => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date > today;
};

export const compareDates = (left: string, right: string): number => {
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) return 0;
  return leftDate.getTime() - rightDate.getTime();
};

export const isLikelyValidFullName = (value: string, minWords = 2): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.split(/\s+/).length < minWords) return false;
  return namePattern.test(trimmed);
};

export const isAllUppercaseText = (value: string): boolean => {
  const lettersOnly = value.replace(/[^A-Za-zÀ-ỹ]/g, '');
  if (!lettersOnly) return false;
  return lettersOnly === lettersOnly.toUpperCase();
};

export const validateAddressDetail = (
  value: string,
  provinceLabel: string,
  wardLabel: string,
): string => {
  const trimmed = value.trim();
  if (!trimmed) return 'Vui lòng nhập địa chỉ chi tiết';
  if (isAllUppercaseText(trimmed)) {
    return 'Địa chỉ chi tiết không được viết toàn bộ bằng chữ in hoa';
  }

  const lowered = trimmed.toLocaleLowerCase('vi-VN');
  if (provinceLabel && lowered.includes(provinceLabel.toLocaleLowerCase('vi-VN'))) {
    return 'Địa chỉ chi tiết không cần lặp lại tỉnh/thành phố đã chọn';
  }

  if (wardLabel && lowered.includes(wardLabel.toLocaleLowerCase('vi-VN'))) {
    return 'Địa chỉ chi tiết không cần lặp lại xã/phường/đặc khu đã chọn';
  }

  return '';
};

export const validateRequiredField = (field: FormField, value: string): string => {
  if (!field.required || value.trim()) return '';
  return field.type === 'select' || field.type === 'radio'
    ? `Vui lòng chọn ${field.label.toLowerCase()}`
    : `Vui lòng nhập ${field.label.toLowerCase()}`;
};

export const validateServiceField = (field: FormField, value: string): string => {
  const requiredError = validateRequiredField(field, value);
  if (requiredError) return requiredError;
  if (!value.trim()) return '';

  if (field.id === 'cccd') {
    return isValidCitizenId(value, [12]) ? '' : 'Số CCCD phải có đúng 12 chữ số';
  }

  if (field.id === 'sdtCoQuan') {
    return isValidAgencyPhone(value) ? '' : 'Số điện thoại cơ quan không hợp lệ';
  }

  if (field.type === 'phone') {
    return isValidVietnamesePhone(value) ? '' : 'Số điện thoại không hợp lệ';
  }

  if (field.id.toLowerCase().includes('email')) {
    return isValidEmail(value) ? '' : 'Email không đúng định dạng';
  }

  if (field.type === 'date') {
    return isFutureDate(value) ? 'Ngày sinh không thể lớn hơn ngày hiện tại' : '';
  }

  if (field.id === 'hoTen' && !isLikelyValidFullName(value)) {
    return 'Họ tên phải có ít nhất 2 từ và không chứa số hoặc ký tự đặc biệt';
  }

  if (field.validation?.maxLength && value.trim().length > field.validation.maxLength) {
    return `${field.label} không được vượt quá ${field.validation.maxLength} ký tự`;
  }

  return '';
};

export const getStandardMemberErrors = (
  member: FamilyMember,
): Partial<Record<keyof Omit<FamilyMember, 'id'>, string>> => {
  const hasAnyValue = (
    member.fullName.trim()
    || member.dateOfBirth.trim()
    || member.gender.trim()
    || member.citizenId.trim()
    || member.relationshipWithHouseholder.trim()
  );

  if (!hasAnyValue) return {};

  const errors: Partial<Record<keyof Omit<FamilyMember, 'id'>, string>> = {};
  if (!member.fullName.trim()) errors.fullName = 'Thiếu họ tên';
  else if (!isLikelyValidFullName(member.fullName)) errors.fullName = 'Họ tên không hợp lệ';

  if (!member.dateOfBirth.trim()) errors.dateOfBirth = 'Thiếu ngày sinh';
  else if (isFutureDate(member.dateOfBirth)) errors.dateOfBirth = 'Ngày sinh không hợp lệ';

  if (!member.gender.trim()) errors.gender = 'Thiếu giới tính';
  if (!member.citizenId.trim()) errors.citizenId = 'Thiếu số định danh';
  else if (!isValidCitizenId(member.citizenId, [12])) errors.citizenId = 'CCCD phải có 12 chữ số';

  if (!member.relationshipWithHouseholder.trim()) {
    errors.relationshipWithHouseholder = 'Thiếu quan hệ với chủ hộ';
  }

  return errors;
};

export const getOverseasStayErrors = (
  row: OverseasStayRow,
): Partial<Record<keyof Omit<OverseasStayRow, 'id'>, string>> => {
  const hasAnyValue = (
    row.fromDate.trim()
    || row.toDate.trim()
    || row.residenceAddress.trim()
    || row.occupation.trim()
  );

  if (!hasAnyValue) return {};

  const errors: Partial<Record<keyof Omit<OverseasStayRow, 'id'>, string>> = {};
  if (!row.fromDate.trim()) errors.fromDate = 'Thiếu thời gian bắt đầu';
  else if (isFutureDate(row.fromDate)) errors.fromDate = 'Ngày bắt đầu không hợp lệ';

  if (row.toDate.trim() && isFutureDate(row.toDate)) errors.toDate = 'Ngày kết thúc không hợp lệ';
  if (row.fromDate.trim() && row.toDate.trim() && compareDates(row.fromDate, row.toDate) > 0) {
    errors.toDate = 'Ngày kết thúc phải sau ngày bắt đầu';
  }

  if (!row.residenceAddress.trim()) errors.residenceAddress = 'Thiếu nơi cư trú';
  if (!row.occupation.trim()) errors.occupation = 'Thiếu nghề nghiệp, nơi làm việc';
  return errors;
};

export const getOverseasFamilyErrors = (
  member: OverseasFamilyMember,
): Partial<Record<keyof Omit<OverseasFamilyMember, 'id'>, string>> => {
  const hasAnyValue = (
    member.fullName.trim()
    || member.dateOfBirth.trim()
    || member.nationality.trim()
    || member.relationship.trim()
    || member.occupation.trim()
    || member.currentAddress.trim()
  );

  if (!hasAnyValue) return {};

  const errors: Partial<Record<keyof Omit<OverseasFamilyMember, 'id'>, string>> = {};

  if (!member.fullName.trim()) errors.fullName = 'Thiếu họ tên';
  if (!member.dateOfBirth.trim()) errors.dateOfBirth = 'Thiếu ngày sinh';
  else if (isFutureDate(member.dateOfBirth)) errors.dateOfBirth = 'Ngày sinh không hợp lệ';
  if (!member.nationality.trim()) errors.nationality = 'Thiếu quốc tịch';
  if (!member.relationship.trim()) errors.relationship = 'Thiếu quan hệ';
  if (!member.currentAddress.trim()) errors.currentAddress = 'Thiếu nơi ở hiện tại';

  return errors;
};
