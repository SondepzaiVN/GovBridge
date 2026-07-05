import React from 'react';
import {
    AlertCircle,
    ArrowLeft,
    Calendar,
    Camera,
    CheckCircle2,
    ChevronRight,
    ChevronDown,
    Download,
    FileDown,
    FileText,
    Files,
    Home,
    LoaderCircle,
    Paperclip,
    Plus,
    Save,
    Send,
    ShieldCheck,
    X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { provinces, getResidenceAgencyName, useWards } from '../../hooks/useAdministrativeUnits';
import { saveApplicationToDashboard, type DashboardDocument } from '../../utils/dashboardSync';
import { saveAttachmentFile } from '../../utils/attachmentStorage';
import { SERVICE_MAP } from '../../data/services';
import { useForm } from '../../contexts/FormContext';
import { ocrService } from '../../api/aiServices';
import type { CCCDInfo, DocumentReviewUiState } from '../../types';
import { reviewUploadedDocument } from '../../utils/attachmentDocumentReview';
import { AttachmentReviewBadge } from '../common/AttachmentReviewBadge';
type FieldKind = 'text' | 'date' | 'select' | 'textarea';

interface FieldConfig {
    id: string;
    label: string;
    kind: FieldKind;
    required?: boolean;
    placeholder?: string;
    options?: string[];
    span?: 1 | 2 | 3;
    readOnly?: boolean;
    disabled?: boolean;
    isAutofilled?: boolean;
}

interface FamilyMember {
    id: number;
    hoTen: string;
    ngaySinh: string;
    gioiTinh: string;
    cccd: string;
    quanHe: string;
}

type XcttCccdTarget = 'applicant' | 'member';
type CccdDialogStep = 'consent' | 'member-count' | 'source';
type CccdQueueStatus = 'waiting' | 'processing' | 'success' | 'error';

interface CccdQueueItem {
    id: string;
    fileName: string;
    status: CccdQueueStatus;
    message: string;
}

const normalizeGenderFromCccd = (value: string) => {
    const normalized = value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    if (normalized.includes('nu')) return 'Nữ';
    if (normalized.includes('nam')) return 'Nam';
    return '';
};

const normalizeCccdNumber = (value: string) => value.replace(/\D/g, '');

const isBlankMember = (member: FamilyMember) =>
    !member.hoTen && !member.ngaySinh && !member.gioiTinh && !member.cccd && !member.quanHe;

const genderOptions = ['Chưa có thông tin', 'Nam', 'Nữ', 'Khác'];
const ethnicityOptions = [
    'Kinh',
    'Tày',
    'Thái',
    'Mường',
    'Khmer',
    'Hoa',
    'Nùng',
    "H'Mông",
    'Dao',
    'Gia Rai',
    'Ê Đê',
    'Ba Na',
    'Sán Chay',
    'Chăm',
    'Cơ Ho',
    'Xơ Đăng',
    'Sán Dìu',
    'Hrê',
    'Ra Glai',
    'Mnông',
    'Thổ',
    'Stiêng',
    'Khơ mú',
    'Bru Vân Kiều',
    'Cơ Tu',
    'Giáy',
    'Tà Ôi',
    'Mạ',
    'Co',
    'Chưa có thông tin',
    'Khác',
];
const procedureOptions = ['Xác nhận thông tin về cư trú'];
const caseOptions = ['Cấp cho NK trên địa bàn quản lí', 'Cấp cho NK khác địa bàn quản lí'];
const relationOptions = [
    'Anh',
    'Anh chồng',
    'Anh họ',
    'Anh rể',
    'Anh ruột',
    'Anh vợ',
    'Ba',
    'Bà',
    'Bà ngoại',
    'Bà nội',
    'Bác',
    'Bạn',
    'Bố',
    'Cậu',
    'Cha',
    'Cha chồng',
    'Cha đẻ',
    'Cha nuôi',
    'Cha vợ',
    'Cháu',
    'Cháu dâu',
    'Cháu họ',
    'Cháu ngoại',
    'Cháu nội',
    'Cháu rể',
    'Chắt',
    'Chị',
    'Chị chồng',
    'Chị dâu',
    'Chị họ',
    'Chị ruột',
    'Chị vợ',
    'Chồng',
    'Chú',
    'Chủ hộ',
    'Chưa có thông tin',
    'Con',
    'Con chồng',
    'Con dâu',
    'Con đẻ',
    'Con nuôi',
    'Con rể',
    'Con vợ',
    'Cô',
    'Cụ',
    'Cùng ở thuê',
    'Dì',
    'Em',
    'Em chồng',
    'Em dâu',
    'Em họ',
    'Em rể',
    'Em ruột',
    'Em vợ',
    'Khác',
    'Mẹ',
    'Mẹ chồng',
    'Mẹ đẻ',
    'Mẹ nuôi',
    'Mẹ vợ',
    'Người được chăm sóc',
    'Người được giám hộ',
    'Người được nuôi dưỡng',
    'Người được trợ giúp',
    'Người giám hộ',
    'Người mượn nhà',
    'Người ở nhờ',
    'Người thuê nhà',
    'Nhân khẩu tập thể',
    'Ông',
    'Ông ngoại',
    'Ông nội',
    'Thím',
    'Tía',
    'Vợ',
];
const notificationReceiveOptions = ['Qua email', 'Nhận qua cổng thông tin'];
const resultReceiveOptions = ['Nhận trực tiếp', 'Qua email', 'Nhận qua cổng thông tin'];

const createMember = (id: number): FamilyMember => ({
    id,
    hoTen: '',
    ngaySinh: '',
    gioiTinh: '',
    cccd: '',
    quanHe: '',
});

const getResidenceAgencyOptions = (wardName: string): string[] => (wardName ? [getResidenceAgencyName(wardName)] : []);

const getWardFieldPlaceholder = (provinceName: string, isLoading: boolean): string => {
    if (!provinceName) return 'Chọn';
    return isLoading ? 'Đang tải...' : 'Chọn';
};

const createAgencyFields = (
    wardOptions: string[],
    selectedProvince: string,
    selectedWard: string,
    isLoading: boolean,
): FieldConfig[] => [
    {
        id: 'provinceAgency',
        label: 'Tỉnh/ Thành phố',
        kind: 'select',
        required: true,
        placeholder: 'Chọn',
        options: provinces,
    },
    {
        id: 'wardAgency',
        label: 'Xã/Phường/Đặc khu',
        kind: 'select',
        required: true,
        placeholder: getWardFieldPlaceholder(selectedProvince, isLoading),
        options: wardOptions,
    },
    {
        id: 'residenceAgency',
        label: 'Cơ quan đăng ký cư trú',
        kind: 'select',
        required: true,
        placeholder: 'Chọn',
        options: getResidenceAgencyOptions(selectedWard),
        readOnly: true,
        isAutofilled: !!selectedWard,
    },
    {
        id: 'agencyPhone',
        label: 'Số điện thoại cơ quan',
        kind: 'text',
        readOnly: true,
        placeholder: '0292 3894 939',
        isAutofilled: true,
    },
];

const procedureFields: FieldConfig[] = [
    {
        id: 'procedure',
        label: 'Thủ tục',
        kind: 'select',
        required: true,
        placeholder: 'Thủ tục',
        options: procedureOptions,
        readOnly: true,
    },
    { id: 'caseType', label: 'Trường hợp', kind: 'select', required: true, placeholder: 'Chọn', options: caseOptions },
];

const applicantFields: FieldConfig[] = [
    { id: 'fullName', label: 'Họ tên', kind: 'text', required: true },
    {
        id: 'birthType',
        label: 'Ngày sinh',
        kind: 'select',
        required: true,
        options: ['Ngày tháng năm', 'Tháng năm', 'Năm'],
        placeholder: 'Ngày tháng năm',
    },
    { id: 'birthDate', label: 'Ngày sinh', kind: 'text', required: true, placeholder: 'Chọn thời gian' },
    { id: 'gender', label: 'Giới tính', kind: 'select', required: true, placeholder: 'Chọn', options: genderOptions },
    {
        id: 'ethnicity',
        label: 'Dân tộc',
        kind: 'select',
        required: true,
        placeholder: 'Dân tộc',
        options: ethnicityOptions,
    },
    { id: 'citizenId', label: 'Số ĐDCN (CCCD)', kind: 'text', required: true },
    { id: 'phone', label: 'SĐT liên hệ', kind: 'text' },
    { id: 'email', label: 'Email', kind: 'text' },
];

const createRequestFields = (wardOptions: string[], selectedProvince: string, isLoading: boolean): FieldConfig[] => [
    {
        id: 'requestProvince',
        label: 'Tỉnh/ Thành phố',
        kind: 'select',
        required: true,
        placeholder: 'Chọn',
        options: provinces,
    },
    {
        id: 'requestWard',
        label: 'Xã/Phường/Đặc khu',
        kind: 'select',
        required: true,
        placeholder: getWardFieldPlaceholder(selectedProvince, isLoading),
        options: wardOptions,
    },
    {
        id: 'address',
        label: 'Địa chỉ (số nhà, đường phố, thôn, xóm, làng, ấp, bản, buôn, phum, sóc)',
        kind: 'text',
        required: true,
        placeholder: 'Địa chỉ nơi cư trú hiện tại của công dân',
        span: 2,
    },
    { id: 'requestContent', label: 'Nội dung đề nghị', kind: 'textarea', required: true, span: 2, readOnly: true },
];

const initialValues: Record<string, string> = {
    birthType: 'Ngày tháng năm',
    procedure: 'Xác nhận thông tin về cư trú',
    notificationMethod: 'Nhận qua cổng thông tin',
    resultMethod: 'Nhận qua cổng thông tin',
};

const CT01_TEMPLATE_URL = 'https://cdn.thuvienphapluat.vn/uploads/mst/images/DoanTien/CT01-mau.docx';

const escapeDeclarationHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const getDeclarationText = (values: Record<string, string>, fieldId: string, fallback = '') =>
    (values[fieldId] || fallback).trim();

const joinDeclarationParts = (parts: string[], separator = ', ') =>
    parts.map((part) => part.trim()).filter(Boolean).join(separator);

const formatDeclarationDate = (value: string) => {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    if (!year || !month || !day) return value;
    return `${day}/${month}/${year}`;
};

const buildXcttDeclarationHtml = (values: Record<string, string>, members: FamilyMember[]) => {
    const today = new Date();
    const residenceAddress = joinDeclarationParts([
        getDeclarationText(values, 'address'),
        getDeclarationText(values, 'requestWard'),
        getDeclarationText(values, 'requestProvince'),
    ]);
    const filteredMembers = members.filter((member) => !isBlankMember(member));
    const memberRows: Array<FamilyMember | null> = [
        ...filteredMembers,
        ...Array.from({ length: Math.max(5, 8 - filteredMembers.length) }, () => null),
    ];
    const memberRowsHtml = memberRows
        .map((member, index) => {
            return `<tr>
                <td>${member ? index + 1 : ''}</td>
                <td>${escapeDeclarationHtml(member?.hoTen || '')}</td>
                <td>${escapeDeclarationHtml(member ? formatDeclarationDate(member.ngaySinh) : '')}</td>
                <td>${escapeDeclarationHtml(member?.gioiTinh || '')}</td>
                <td>${escapeDeclarationHtml(member?.cccd || '')}</td>
                <td>${escapeDeclarationHtml(member?.quanHe || '')}</td>
            </tr>`;
        })
        .join('');

    return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Tờ khai thay đổi thông tin cư trú (CT01)</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #eef1f5; color: #000; font-family: "Times New Roman", Times, serif; font-size: 13px; line-height: 1.28; }
    .sheet { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 17mm 19mm 14mm; background: #fff; }
    .meta { text-align: right; font-size: 12px; margin-bottom: 12px; }
    .national { text-align: center; font-weight: 700; line-height: 1.35; margin-bottom: 18px; }
    .national .underline { display: inline-block; border-bottom: 1px solid #000; padding: 0 20px 2px; }
    h1 { margin: 0 0 12px; text-align: center; font-size: 18px; line-height: 1.3; text-transform: uppercase; }
    p { margin: 4px 0; }
    .recipient { margin: 0 0 10px; }
    .line { margin: 5px 0; }
    .box { display: inline-block; min-width: 132px; padding: 2px 8px; border: 1px solid #333; text-align: center; vertical-align: middle; }
    .content { margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
    th, td { border: 1px solid #222; padding: 4px 5px; text-align: center; vertical-align: middle; }
    th { font-weight: 700; }
    td:nth-child(2) { text-align: left; }
    tr { height: 24px; }
    .signatures { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 28px; text-align: center; font-size: 11px; }
    .signature-date { margin-bottom: 3px; }
    .signature-title { font-weight: 700; text-transform: uppercase; }
    .signature-note { font-size: 10px; }
    .signature-name { margin-top: 42px; font-weight: 700; }
  </style>
</head>
<body>
  <main class="sheet">
    <div class="meta">Mẫu CT01 ban hành kèm theo Thông tư số 116/2026/TT-BCA<br />ngày 29 tháng 6 năm 2026 của Bộ trưởng Bộ Công an</div>
    <div class="national">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br /><span class="underline">Độc lập - Tự do - Hạnh phúc</span></div>
    <h1>TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ</h1>
    <p class="recipient">Kính gửi(1): ${escapeDeclarationHtml(getDeclarationText(values, 'residenceAgency', 'Cơ quan đăng ký cư trú nơi tiếp nhận hồ sơ'))}</p>
    <p class="line">1. Họ, chữ đệm và tên khai sinh: ${escapeDeclarationHtml(getDeclarationText(values, 'fullName'))}</p>
    <p class="line">2. Ngày, tháng, năm sinh: ${escapeDeclarationHtml(formatDeclarationDate(getDeclarationText(values, 'birthDate')))} &nbsp;&nbsp;&nbsp; 3. Giới tính: ${escapeDeclarationHtml(getDeclarationText(values, 'gender'))}</p>
    <p class="line">4. Số định danh cá nhân: <span class="box">${escapeDeclarationHtml(getDeclarationText(values, 'citizenId'))}</span></p>
    <p class="line">5. Số điện thoại liên hệ: ${escapeDeclarationHtml(getDeclarationText(values, 'phone'))} &nbsp;&nbsp;&nbsp; 6. Email: ${escapeDeclarationHtml(getDeclarationText(values, 'email'))}</p>
    <p class="line">7. Họ, chữ đệm và tên chủ hộ: ${escapeDeclarationHtml(getDeclarationText(values, 'householderName'))} &nbsp;&nbsp;&nbsp; 8. Mối quan hệ với chủ hộ: ${escapeDeclarationHtml(getDeclarationText(values, 'relationWithHouseholder'))}</p>
    <p class="line">9. Số định danh cá nhân của chủ hộ: <span class="box">${escapeDeclarationHtml(getDeclarationText(values, 'householderId'))}</span></p>
    <p class="line content">10. Nội dung đề nghị(3): ${escapeDeclarationHtml(getDeclarationText(values, 'requestContent') || `Đề nghị xác nhận thông tin cư trú tại ${residenceAddress}.`)}</p>
    <p class="line">....................................................................................................................................................</p>
    <p class="line">11. Những thành viên trong hộ gia đình cùng thay đổi:</p>
    <table>
      <thead>
        <tr>
          <th style="width: 34px;">TT</th>
          <th>Họ, chữ đệm<br />và tên</th>
          <th style="width: 92px;">Ngày, tháng,<br />năm sinh</th>
          <th style="width: 54px;">Giới<br />tính</th>
          <th style="width: 116px;">Số định danh<br />cá nhân</th>
          <th style="width: 96px;">Mối quan hệ<br />với chủ hộ</th>
        </tr>
      </thead>
      <tbody>${memberRowsHtml}</tbody>
    </table>
    <section class="signatures">
      ${['Ý KIẾN CỦA CHỦ HỘ(4)', 'Ý KIẾN CỦA CHỦ SỞ HỮU CHỖ Ở HỢP PHÁP(5)', 'Ý KIẾN CỦA CHA HOẶC MẸ HOẶC NGƯỜI GIÁM HỘ(6)', 'NGƯỜI KÊ KHAI(7)']
        .map(
            (title) => `<div>
              <div class="signature-date">Cần Thơ, ngày ${String(today.getDate()).padStart(2, '0')} tháng ${String(today.getMonth() + 1).padStart(2, '0')} năm ${today.getFullYear()}</div>
              <div class="signature-title">${title}</div>
              <div class="signature-note">Tôi đồng ý cho cá nhân trên nộp hồ sơ đăng ký thay đổi thông tin cư trú</div>
              <div class="signature-name">${title === 'NGƯỜI KÊ KHAI(7)' ? escapeDeclarationHtml(getDeclarationText(values, 'fullName')) : ''}</div>
            </div>`,
        )
        .join('')}
    </section>
  </main>
</body>
</html>`;
};

const XacNhanCuTruPage: React.FC = () => {
    const navigate = useNavigate();
    const { formState } = useForm();
    const service = SERVICE_MAP['xac-nhan-cu-tru'] || {
        requiredDocs: [],
        steps: [],
        processingTime: '',
        fee: '',
        category: '',
    };
    const [values, setValues] = React.useState<Record<string, string>>(initialValues);
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
        agency: true,
        procedure: true,
        applicant: true,
        request: true,
        attachment: true,
        notification: true,
    });
    const [declareMode, setDeclareMode] = React.useState('proxy');
    const [members, setMembers] = React.useState<FamilyMember[]>([createMember(1)]);
    const [uploadedFile, setUploadedFile] = React.useState<File | null>(null);
    const [attachmentReview, setAttachmentReview] = React.useState<DocumentReviewUiState | undefined>();
    const [attachmentKind, setAttachmentKind] = React.useState('Bản gốc');
    const [attachmentQuantity, setAttachmentQuantity] = React.useState('1');
    const [attachmentNote, setAttachmentNote] = React.useState('');
    const [isGeneratingDeclaration, setIsGeneratingDeclaration] = React.useState(false);
    const [declarationPreview, setDeclarationPreview] = React.useState<{
        title: string;
        url: string;
        downloadName: string;
    } | null>(null);
    const declarationPreviewUrlRef = React.useRef<string | null>(null);
    const [pledged, setPledged] = React.useState(false);
    const [showSuccess, setShowSuccess] = React.useState(false);
    const [draftSaved, setDraftSaved] = React.useState(false);
    const [ocrNotice, setOcrNotice] = React.useState('');
    const [isReadingCccd, setIsReadingCccd] = React.useState(false);
    const cccdInputRef = React.useRef<HTMLInputElement>(null);
    const cccdCameraInputRef = React.useRef<HTMLInputElement>(null);
    const cccdTargetRef = React.useRef<XcttCccdTarget>('applicant');
    const expectedMemberFileCountRef = React.useRef(1);
    const [cccdDialogStep, setCccdDialogStep] = React.useState<CccdDialogStep | null>(null);
    const [pendingCccdTarget, setPendingCccdTarget] = React.useState<XcttCccdTarget>('applicant');
    const [memberUploadCount, setMemberUploadCount] = React.useState(1);
    const [memberUploadError, setMemberUploadError] = React.useState('');
    const [cccdQueue, setCccdQueue] = React.useState<CccdQueueItem[]>([]);
    const { wardOptions: agencyWardOptions, loading: loadingAgencyWards } = useWards(values.provinceAgency);
    const { wardOptions: requestWardOptions, loading: loadingRequestWards } = useWards(values.requestProvince);

    const showOcrNotice = (message: string) => {
        setOcrNotice(message);
        window.setTimeout(() => setOcrNotice(''), 3200);
    };

    React.useEffect(() => {
        const ocrFields: Record<string, string> = {};
        ['fullName', 'birthDate', 'gender', 'citizenId'].forEach((fieldId) => {
            const value = formState.values[fieldId];
            if (formState.touched[fieldId] && value && values[fieldId] !== value) {
                ocrFields[fieldId] = value;
            }
        });

        if (Object.keys(ocrFields).length > 0) {
            setValues((current) => ({ ...current, ...ocrFields }));
            setErrors((current) => ({
                ...current,
                ...Object.fromEntries(Object.keys(ocrFields).map((fieldId) => [fieldId, ''])),
            }));
        }
    }, [formState.touched, formState.values, values]);

    React.useEffect(
        () => () => {
            if (declarationPreviewUrlRef.current) {
                URL.revokeObjectURL(declarationPreviewUrlRef.current);
            }
        },
        [],
    );

    const agencyFields = React.useMemo(
        () =>
            createAgencyFields(
                agencyWardOptions,
                values.provinceAgency || '',
                values.wardAgency || '',
                loadingAgencyWards,
            ),
        [agencyWardOptions, loadingAgencyWards, values.provinceAgency, values.wardAgency],
    );

    const requestFields = React.useMemo(
        () => createRequestFields(requestWardOptions, values.requestProvince || '', loadingRequestWards),
        [loadingRequestWards, requestWardOptions, values.requestProvince],
    );

    const setFieldValue = (fieldId: string, value: string) => {
        setValues((current) => {
            let nextValues = { ...current };

            if (fieldId === 'provinceAgency') {
                nextValues = { ...nextValues, provinceAgency: value, wardAgency: '', residenceAgency: '' };
            } else if (fieldId === 'requestProvince') {
                nextValues = { ...nextValues, requestProvince: value, requestWard: '' };
            } else if (fieldId === 'wardAgency') {
                nextValues = {
                    ...nextValues,
                    wardAgency: value,
                    residenceAgency: value ? getResidenceAgencyName(value) : '',
                };
            } else if (fieldId === 'birthType' && value !== current.birthType) {
                nextValues = { ...nextValues, birthType: value, birthDate: '' };
            } else {
                nextValues = { ...nextValues, [fieldId]: value };
            }

            if (['requestProvince', 'requestWard', 'address'].includes(fieldId)) {
                const address = nextValues.address;
                const wardName = nextValues.requestWard;
                const provinceName = nextValues.requestProvince;
                if (address && wardName && provinceName) {
                    nextValues.requestContent = `Xác nhận cư trú tại ${address}, ${wardName}, ${provinceName}.`;
                } else {
                    nextValues.requestContent = '';
                }
            }

            return nextValues;
        });
        setErrors((current) => {
            const nextErrors = { ...current, [fieldId]: '' };
            if (fieldId === 'provinceAgency') {
                nextErrors.wardAgency = '';
                nextErrors.residenceAgency = '';
            }
            if (fieldId === 'requestProvince') nextErrors.requestWard = '';
            if (fieldId === 'wardAgency') nextErrors.residenceAgency = '';
            return nextErrors;
        });
    };

    const handleAttachmentFileChange = (file: File | undefined) => {
        if (!file) return;
        setUploadedFile(file);
        void reviewUploadedDocument({
            file,
            label: 'hồ sơ xác nhận cư trú',
            currentRoute: '/xac-nhan-cu-tru',
            documentType: 'ct01',
            onStatusChange: setAttachmentReview,
        });
    };

    const closeDeclarationPreview = () => {
        if (declarationPreviewUrlRef.current) {
            URL.revokeObjectURL(declarationPreviewUrlRef.current);
            declarationPreviewUrlRef.current = null;
        }
        setDeclarationPreview(null);
    };

    const handleGenerateDeclaration = () => {
        setIsGeneratingDeclaration(true);
        window.setTimeout(() => {
            if (declarationPreviewUrlRef.current) {
                URL.revokeObjectURL(declarationPreviewUrlRef.current);
            }
            const html = buildXcttDeclarationHtml(values, members);
            const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
            declarationPreviewUrlRef.current = url;
            setDeclarationPreview({
                title: 'Tờ khai thay đổi thông tin cư trú (CT01)',
                url,
                downloadName: 'to-khai-thay-doi-thong-tin-cu-tru-ct01.doc',
            });
            setIsGeneratingDeclaration(false);
        }, 1300);
    };

    const toggleSection = (sectionId: string) => {
        setOpenSections((current) => ({ ...current, [sectionId]: !current[sectionId] }));
    };

    const updateMember = (id: number, key: keyof Omit<FamilyMember, 'id'>, value: string) => {
        setMembers((current) => current.map((member) => (member.id === id ? { ...member, [key]: value } : member)));
        setErrors((current) => ({ ...current, [`member-${id}-${key}`]: '' }));
    };

    const applyCccdToApplicant = (info: CCCDInfo) => {
        const nextValues: Record<string, string> = {
            fullName: info.hoTen || values.fullName || '',
            birthDate: info.ngaySinh || values.birthDate || '',
            gender: normalizeGenderFromCccd(info.gioiTinh) || values.gender || '',
            citizenId: normalizeCccdNumber(info.id || values.citizenId || ''),
        };
        setValues((current) => ({ ...current, ...nextValues }));
        setErrors((current) => ({
            ...current,
            fullName: '',
            birthDate: '',
            gender: '',
            citizenId: '',
        }));
    };

    const handleSectionCccdUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        event.target.value = '';
        if (files.length === 0) return;

        const target = cccdTargetRef.current;
        if (target === 'member' && files.length !== expectedMemberFileCountRef.current) {
            setMemberUploadError(
                `Vui lòng chọn đúng ${expectedMemberFileCountRef.current} ảnh CCCD, mỗi người một ảnh.`,
            );
            setCccdDialogStep('member-count');
            return;
        }

        const queueItems: CccdQueueItem[] = files.map((file, index) => ({
            id: `${file.name}-${file.lastModified}-${index}`,
            fileName: file.name,
            status: 'waiting',
            message: 'Đang chờ xử lý',
        }));
        if (target === 'member') setCccdQueue(queueItems);

        const updateQueueItem = (id: string, status: CccdQueueStatus, message: string) => {
            setCccdQueue((current) =>
                current.map((item) => (item.id === id ? { ...item, status, message } : item)),
            );
        };

        setIsReadingCccd(true);
        if (target === 'applicant') {
            const file = files[0];
            try {
                const info = await ocrService.extractCCCDInfo(await ocrService.resizeImage(file), {
                    showProcessingNotice: false,
                });
                applyCccdToApplicant(info);
                showOcrNotice('Đã điền thông tin người đề nghị từ CCCD.');
            } catch (error) {
                console.error('Không đọc được CCCD cho xác nhận cư trú:', error);
                showOcrNotice('Không đọc được CCCD. Vui lòng thử lại ảnh rõ hơn.');
            } finally {
                setIsReadingCccd(false);
            }
            return;
        }

        let nextMembers = members.map((member) => ({ ...member }));
        let nextMemberId = Math.max(0, ...nextMembers.map((member) => member.id)) + 1;
        let addedCount = 0;
        const clearedMemberErrors: Record<string, string> = {};

        for (const [index, file] of files.entries()) {
            const queueItem = queueItems[index];
            updateQueueItem(queueItem.id, 'processing', 'VNPT AI đang đọc CCCD...');

            try {
                const info = await ocrService.extractCCCDInfo(await ocrService.resizeImage(file), {
                    showProcessingNotice: false,
                });
                const citizenId = normalizeCccdNumber(info.id || '');
                const duplicatedMember = Boolean(
                    citizenId &&
                        (normalizeCccdNumber(values.citizenId || '') === citizenId ||
                            nextMembers.some((member) => normalizeCccdNumber(member.cccd) === citizenId)),
                );

                if (duplicatedMember) {
                    updateQueueItem(queueItem.id, 'error', 'CCCD đã có trong danh sách');
                    continue;
                }

                const cccdMember: Omit<FamilyMember, 'id'> = {
                    hoTen: info.hoTen || '',
                    ngaySinh: info.ngaySinh || '',
                    gioiTinh: normalizeGenderFromCccd(info.gioiTinh),
                    cccd: citizenId,
                    quanHe: '',
                };
                const blankMemberIndex = nextMembers.findIndex(isBlankMember);

                if (blankMemberIndex >= 0) {
                    nextMembers[blankMemberIndex] = {
                        ...nextMembers[blankMemberIndex],
                        ...cccdMember,
                    };
                    const memberId = nextMembers[blankMemberIndex].id;
                    clearedMemberErrors[`member-${memberId}-hoTen`] = '';
                    clearedMemberErrors[`member-${memberId}-ngaySinh`] = '';
                    clearedMemberErrors[`member-${memberId}-gioiTinh`] = '';
                    clearedMemberErrors[`member-${memberId}-cccd`] = '';
                } else {
                    nextMembers.push({ id: nextMemberId, ...cccdMember });
                    nextMemberId += 1;
                }

                addedCount += 1;
                updateQueueItem(
                    queueItem.id,
                    'success',
                    info.hoTen ? `Đã điền: ${info.hoTen}` : 'Đã tự động điền',
                );
            } catch (error) {
                console.error(`Không đọc được CCCD "${file.name}":`, error);
                updateQueueItem(queueItem.id, 'error', 'Không đọc được ảnh CCCD');
            }
        }

        if (addedCount > 0) {
            setMembers(nextMembers);
            setErrors((current) => ({ ...current, ...clearedMemberErrors }));
            showOcrNotice(`Đã tự động điền ${addedCount}/${files.length} thành viên từ CCCD.`);
        } else {
            showOcrNotice('Chưa có ảnh CCCD nào được xử lý thành công.');
        }

        setIsReadingCccd(false);
    };

    const openCccdFilePicker = (source: 'file' | 'camera') => {
        window.setTimeout(() => {
            if (source === 'camera') {
                cccdCameraInputRef.current?.click();
                return;
            }
            cccdInputRef.current?.click();
        }, 0);
    };

    const openSectionCccdCamera = (target: XcttCccdTarget) => {
        cccdTargetRef.current = target;
        setPendingCccdTarget(target);
        setMemberUploadError('');
        setCccdDialogStep('consent');
    };

    const acceptCccdConsent = () => {
        if (pendingCccdTarget === 'member') {
            setCccdDialogStep('member-count');
            return;
        }

        setCccdDialogStep(null);
        setCccdDialogStep('source');
    };

    const confirmMemberUploadCount = () => {
        const normalizedCount = Math.min(10, Math.max(1, Math.trunc(memberUploadCount || 1)));
        setMemberUploadCount(normalizedCount);
        expectedMemberFileCountRef.current = normalizedCount;
        cccdTargetRef.current = 'member';
        setMemberUploadError('');
        setCccdDialogStep('source');
    };

    const chooseCccdSource = (source: 'file' | 'camera') => {
        setCccdDialogStep(null);
        openCccdFilePicker(source);
    };

    const declineCccdConsent = () => {
        setCccdDialogStep(null);
        setMemberUploadError('');
        if (cccdInputRef.current) {
            setIsReadingCccd(false);
            cccdInputRef.current.value = '';
        }
        if (cccdCameraInputRef.current) {
            cccdCameraInputRef.current.value = '';
        }
    };

    const renderCccdHeaderAction = (target: XcttCccdTarget, label: string) => (
        <button
            type="button"
            className="dktt-section-camera-btn"
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openSectionCccdCamera(target);
            }}
            disabled={isReadingCccd}
            title={label}
            aria-label={label}
        >
            <Camera size={16} />
        </button>
    );

    const validate = () => {
        const nextErrors: Record<string, string> = {};
        const allFields = [...agencyFields, ...procedureFields, ...applicantFields, ...requestFields];

        allFields.forEach((field) => {
            if (field.required && !String(values[field.id] || '').trim()) {
                nextErrors[field.id] = 'Vui lòng nhập thông tin bắt buộc.';
            }
        });

        if (declareMode === 'proxy') {
            members.forEach((member) => {
                const hasAnyValue = (['hoTen', 'ngaySinh', 'gioiTinh', 'cccd', 'quanHe'] as const).some(
                    (key) => !!String(member[key] || '').trim(),
                );

                if (hasAnyValue) {
                    (['hoTen', 'ngaySinh', 'gioiTinh', 'cccd', 'quanHe'] as const).forEach((key) => {
                        if (!String(member[key] || '').trim()) {
                            nextErrors[`member-${member.id}-${key}`] = 'Bắt buộc';
                        }
                    });
                }
            });
        }

        if (!pledged) nextErrors.pledge = 'Vui lòng xác nhận cam kết trước khi nộp hồ sơ.';
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSubmit = async () => {
        setDraftSaved(false);
        if (!validate()) return;

        const attachments = [];
        if (uploadedFile) {
            const metadata = await saveAttachmentFile(uploadedFile);
            attachments.push(metadata);
        }

        const documents: DashboardDocument[] = uploadedFile
            ? [{ name: uploadedFile.name, state: 'Đã có' }]
            : [{ name: 'Chưa tải file đính kèm', state: 'Cần kiểm tra' }];

        let aggregatedOfficerNote = '';
        let finalFlag = '';
        if (attachmentReview?.text) {
            aggregatedOfficerNote = `[${uploadedFile?.name || 'Tệp đính kèm'}]: ${attachmentReview.text}`;
            finalFlag = attachmentReview.flag || '';
        }

        saveApplicationToDashboard({
            procedure: 'Xác nhận thông tin về cư trú',
            applicant: values.fullName || values.xctt_hoTen || '',
            citizenId: values.citizenId || values.xctt_cccd || '',
            phone: values.phone || values.xctt_sdt || '',
            email: values.email || values.xctt_email || '',
            documents,
            message: values.requestContent || 'Điền thiếu',
            caseNote: 'Xác nhận cư trú',
            details: {
                'Tỉnh/Thành phố đề nghị': values.requestProvince || '',
                'Phường/Xã đề nghị': values.requestWard || '',
                'Địa chỉ hiện tại': values.address || '',
                'Cơ quan tiếp nhận': values.residenceAgency || '',
                'Trường hợp': values.caseType || '',
            },
            officerNote: aggregatedOfficerNote.trim(),
            officerNoteFlag: finalFlag,
            attachments,
        });

        setShowSuccess(true);
    };

    const handleSaveDraft = () => {
        setDraftSaved(true);
        window.setTimeout(() => setDraftSaved(false), 3500);
    };

    return (
        <div className="xctt-page">
            <div className="xctt-breadcrumb">
                <Home size={16} />
                <span className="breadcrumb-link">Trang chủ</span>
                <ChevronRight size={13} className="breadcrumb-sep" />
                <span className="breadcrumb-link">Cư trú</span>
                <ChevronRight size={13} className="breadcrumb-sep" />
                <strong aria-current="page">Hồ sơ Xác nhận thông tin về cư trú</strong>
            </div>

            <div className="xctt-title-row">
                <div>
                    <span>HỒ SƠ</span>
                    <h1>Xác nhận thông tin về cư trú</h1>
                </div>
                <p>Số hồ sơ -</p>
            </div>

            <div className="dktt-ai-hint" data-highlight-id="ai-hint">
                <span className="dktt-ai-hint-icon">
                    <img src="/logo_Gov_Bridge.jpg" alt="AI" />
                </span>
                <span>
                    <strong>Mẹo:</strong> Nhấn vào nút Trợ lý AI (góc phải) để tự động điền form bằng{' '}
                    <strong>giọng nói</strong> hoặc <strong>ảnh CCCD</strong>.
                </span>
            </div>

            <p className="dktt-required-note xctt-note">
                <strong>Ghi chú:</strong> Các thông tin có dấu <span className="red">(*)</span> là thông tin bắt buộc
                phải nhập
            </p>
            <input
                ref={cccdInputRef}
                type="file"
                accept="image/*"
                multiple={pendingCccdTarget === 'member'}
                className="dktt-hidden-file-input"
                onChange={handleSectionCccdUpload}
            />
            <input
                ref={cccdCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple={pendingCccdTarget === 'member'}
                className="dktt-hidden-file-input"
                onChange={handleSectionCccdUpload}
            />
            <XcttSection
                id="agency"
                number={1}
                title="CƠ QUAN THỰC HIỆN"
                open={openSections.agency}
                onToggle={toggleSection}
            >
                <FieldGrid fields={agencyFields} values={values} errors={errors} onChange={setFieldValue} columns={4} />
            </XcttSection>

            <XcttSection
                id="procedure"
                number={2}
                title="THỦ TỤC HÀNH CHÍNH YÊU CẦU"
                open={openSections.procedure}
                onToggle={toggleSection}
            >
                <FieldGrid fields={procedureFields} values={values} errors={errors} onChange={setFieldValue} />
            </XcttSection>

            <XcttSection
                id="applicant"
                number={3}
                title="THÔNG TIN NGƯỜI XÁC NHẬN THÔNG TIN VỀ CƯ TRÚ"
                open={openSections.applicant}
                onToggle={toggleSection}
                action={renderCccdHeaderAction('applicant', 'Đọc CCCD cho người đề nghị')}
            >
                <div className="dktt-choice-group" style={{ marginBottom: 20 }}>
                    <div className="dktt-choice-grid">
                        <label className="dktt-choice-card">
                            <input
                                type="radio"
                                checked={declareMode === 'self'}
                                onChange={() => setDeclareMode('self')}
                            />
                            <span>
                                <strong>Người khai là người xác nhận thông tin về cư trú</strong>
                                <small>Tự động điền các thông tin của chủ tài khoản được lấy từ dữ liệu dân cư.</small>
                            </span>
                        </label>
                        <label className="dktt-choice-card">
                            <input
                                type="radio"
                                checked={declareMode === 'proxy'}
                                onChange={() => setDeclareMode('proxy')}
                            />
                            <span>
                                <strong>Khai hộ</strong>
                                <small>
                                    Cho phép nhập tay đầy đủ thông tin người được khai hộ để đối chiếu với dữ liệu dân
                                    cư.
                                </small>
                            </span>
                        </label>
                    </div>
                </div>
                <ApplicantFieldGrid fields={applicantFields} values={values} errors={errors} onChange={setFieldValue} />
                <FamilyMemberTable
                    members={members}
                    errors={errors}
                    onAdd={() => setMembers((current) => [...current, createMember(current.length + 1)])}
                    onRemove={(id) => setMembers((current) => current.filter((m) => m.id !== id))}
                    onChange={updateMember}
                    action={renderCccdHeaderAction('member', 'Đọc CCCD và thêm thành viên')}
                    cccdQueue={cccdQueue}
                    isReadingCccd={isReadingCccd}
                    onClearCccdQueue={() => setCccdQueue([])}
                />
            </XcttSection>

            <XcttSection
                id="request"
                number={4}
                title="THÔNG TIN ĐỀ NGHỊ"
                open={openSections.request}
                onToggle={toggleSection}
            >
                <h3 className="xctt-subtitle">
                    Nơi đề nghị xác nhận thông tin về cư trú <span>(*)</span>
                </h3>
                <FieldGrid fields={requestFields} values={values} errors={errors} onChange={setFieldValue} />
            </XcttSection>

            <XcttSection
                id="attachment"
                number={5}
                title="TRƯỜNG HỢP VÀ HỒ SƠ ĐÍNH KÈM(*)"
                open={openSections.attachment}
                onToggle={toggleSection}
            >
                <p className="xctt-upload-intro">
                    Vui lòng chọn trường hợp và đính kèm các tập tin hình ảnh về các loại giấy tờ sau để giúp cơ quan
                    chức năng xác minh và giải quyết hồ sơ của ông/bà
                </p>
                <div className="dktt-doc-table-wrapper xctt-doc-table-wrapper">
                    <table className="dktt-doc-table xctt-doc-table">
                        <thead>
                            <tr>
                                <th className="dktt-doc-col-stt">STT</th>
                                <th className="dktt-doc-col-pick" aria-label="Chọn hồ sơ"></th>
                                <th>Tên giấy tờ</th>
                                <th className="dktt-doc-col-kind">Loại giấy tờ</th>
                                <th className="dktt-doc-col-template">Tải file mẫu</th>
                                <th className="dktt-doc-col-template">Tạo tờ khai tự động</th>
                                <th className="dktt-doc-col-specialized">Khai thác CSDL chuyên ngành / Biểu mẫu điện tử</th>
                                <th className="dktt-doc-col-attach">Đính kèm</th>
                                <th className="dktt-doc-col-quantity">Số lượng</th>
                                <th className="dktt-doc-col-note">Ghi chú</th>
                                <th className="dktt-doc-col-action">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="dktt-doc-cell-stt dktt-doc-cell-center">1</td>
                                <td className="dktt-doc-cell-pick dktt-doc-cell-center">
                                    <input className="dktt-doc-checkbox" type="checkbox" checked readOnly />
                                </td>
                                <td>
                                    <div className="dktt-doc-name">
                                        <strong>Tờ khai thay đổi thông tin cư trú (CT01)</strong>
                                    </div>
                                </td>
                                <td>
                                    <select
                                        className="dktt-table-select dktt-doc-select"
                                        value={attachmentKind}
                                        onChange={(event) => setAttachmentKind(event.target.value)}
                                    >
                                        <option value="Bản gốc">Bản gốc</option>
                                        <option value="Bản sao">Bản sao</option>
                                        <option value="Bản chụp">Bản chụp</option>
                                    </select>
                                </td>
                                <td className="dktt-doc-cell-center">
                                    <a
                                        className="dktt-doc-icon-btn"
                                        href={CT01_TEMPLATE_URL}
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Tải file mẫu"
                                        aria-label="Tải file mẫu"
                                    >
                                        <FileDown size={14} />
                                    </a>
                                </td>
                                <td className="dktt-doc-cell-center">
                                    <button
                                        type="button"
                                        className="dktt-doc-icon-btn xctt-generate-doc-btn"
                                        onClick={handleGenerateDeclaration}
                                        disabled={isGeneratingDeclaration}
                                        title="Tạo tờ khai tự động"
                                        aria-label="Tạo tờ khai tự động"
                                    >
                                        {isGeneratingDeclaration ? (
                                            <LoaderCircle size={14} className="xctt-spin" />
                                        ) : (
                                            <FileText size={14} />
                                        )}
                                    </button>
                                </td>
                                <td>
                                    <span className="dktt-table-placeholder">Không áp dụng</span>
                                </td>
                                <td>
                                    <label className="dktt-doc-attach">
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/heic,image/heif,.heic,.heif,application/pdf"
                                            onChange={(event) => handleAttachmentFileChange(event.target.files?.[0])}
                                        />
                                        <Paperclip size={14} />
                                        <span>{uploadedFile ? '1 file' : 'Chọn file'}</span>
                                    </label>
                                    {uploadedFile && (
                                        <div className="dktt-doc-file-list">
                                            <span className="attachment-review-inline">
                                                <span>{uploadedFile.name}</span>
                                                <AttachmentReviewBadge review={attachmentReview} />
                                            </span>
                                        </div>
                                    )}
                                </td>
                                <td>
                                    <input
                                        className="dktt-table-input dktt-doc-qty-input"
                                        type="text"
                                        inputMode="numeric"
                                        value={attachmentQuantity}
                                        onChange={(event) =>
                                            setAttachmentQuantity(event.target.value.replace(/\D/g, '').slice(0, 2))
                                        }
                                        placeholder="1"
                                    />
                                </td>
                                <td>
                                    <input
                                        className="dktt-table-input dktt-doc-note-input"
                                        type="text"
                                        value={attachmentNote}
                                        onChange={(event) => setAttachmentNote(event.target.value)}
                                        placeholder="Ghi chú"
                                    />
                                </td>
                                <td className="dktt-doc-cell-center">
                                    <button
                                        type="button"
                                        className="dktt-doc-icon-btn"
                                        title="Thêm hồ sơ"
                                        aria-label="Thêm hồ sơ"
                                        onClick={() => showOcrNotice('Mục hồ sơ này hiện chỉ cần một tờ khai CT01.')}
                                    >
                                        <Plus size={15} />
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </XcttSection>

            <XcttSection
                id="notification"
                number={6}
                title="THÔNG TIN NHẬN THÔNG BÁO TÌNH TRẠNG HỒ SƠ, KẾT QUẢ GIẢI QUYẾT HỒ SƠ"
                open={openSections.notification}
                onToggle={toggleSection}
            >
                <div className="xctt-notification-fields">
                    <MockTagSelect
                        label="Hình thức nhận thông báo"
                        value={values.notificationMethod || notificationReceiveOptions[1]}
                        onClear={() => setFieldValue('notificationMethod', '')}
                    />
                    <FieldControl
                        field={{
                            id: 'resultMethod',
                            label: 'Hình thức nhận kết quả',
                            kind: 'select',
                            options: resultReceiveOptions,
                        }}
                        value={values.resultMethod || resultReceiveOptions[2]}
                        error={errors.resultMethod}
                        onChange={(value) => setFieldValue('resultMethod', value)}
                    />
                </div>
            </XcttSection>

            <label className="xctt-pledge">
                <input
                    type="checkbox"
                    checked={pledged}
                    onChange={(event) => {
                        setPledged(event.target.checked);
                        setErrors((current) => ({ ...current, pledge: '' }));
                    }}
                />
                Tôi xin chịu trách nhiệm trước pháp luật về lời khai trên
            </label>
            {errors.pledge && <p className="xctt-error pledge">{errors.pledge}</p>}

            {draftSaved && <div className="xctt-toast">Đã lưu nháp hồ sơ cư trú.</div>}

            <div className="xctt-actions">
                <button type="button" className="xctt-btn ghost" onClick={() => navigate(-1)}>
                    <ArrowLeft size={18} />
                    Quay lại
                </button>
                <button type="button" className="xctt-btn secondary" onClick={handleSaveDraft}>
                    <Save size={18} />
                    Lưu nháp
                </button>
                <button type="button" className="xctt-btn primary" onClick={handleSubmit}>
                    <Send size={18} />
                    Nộp hồ sơ
                </button>
            </div>

            <aside className="service-sidebar dktt-service-sidebar" aria-label="Thông tin dịch vụ">
                <div className="sidebar-info-card">
                    <div className="sidebar-info-card-header">
                        <div className="sidebar-info-card-title">Giấy tờ cần chuẩn bị</div>
                    </div>
                    <div className="sidebar-info-card-body">
                        <ul className="info-list">
                            {service.requiredDocs.map((doc, index) => (
                                <li key={index} className="info-list-item">
                                    {doc}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="sidebar-info-card">
                    <div className="sidebar-info-card-header">
                        <div className="sidebar-info-card-title">Các bước thực hiện</div>
                    </div>
                    <div className="sidebar-info-card-body">
                        <ol className="steps-list">
                            {service.steps.map((step, index) => (
                                <li key={index}>{step}</li>
                            ))}
                        </ol>
                    </div>
                </div>

                <div className="sidebar-info-card">
                    <div className="sidebar-info-card-header">
                        <div className="sidebar-info-card-title">Thông tin dịch vụ</div>
                    </div>
                    <div className="sidebar-info-card-body">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8375rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Thời gian xử lý</span>
                                <strong style={{ color: '#C8441A' }}>{service.processingTime}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8375rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Lệ phí</span>
                                <strong style={{ color: 'var(--accent)' }}>{service.fee}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8375rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Danh mục</span>
                                <strong>{service.category}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {cccdDialogStep && (
                <div
                    className="cccd-consent-backdrop"
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') declineCccdConsent();
                    }}
                >
                    <section
                        className="cccd-consent-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="cccd-consent-title"
                    >
                        {cccdDialogStep === 'consent' ? (
                            <>
                                <div className="cccd-consent-icon">
                                    <ShieldCheck size={24} />
                                </div>
                                <h2 id="cccd-consent-title">Đồng ý xử lý dữ liệu?</h2>
                                <p>
                                    Ảnh CCCD sẽ được gửi đến <strong>VNPT AI</strong> để xử lý, tự động điền thông tin.
                                    Bạn có đồng ý không?
                                </p>
                                <div className="cccd-consent-actions">
                                    <button type="button" className="cccd-consent-decline" onClick={declineCccdConsent}>
                                        Từ chối
                                    </button>
                                    <button
                                        type="button"
                                        className="cccd-consent-accept"
                                        onClick={acceptCccdConsent}
                                        autoFocus
                                    >
                                        Đồng ý
                                    </button>
                                </div>
                            </>
                        ) : cccdDialogStep === 'member-count' ? (
                            <>
                                <div className="cccd-consent-icon">
                                    <Files size={24} />
                                </div>
                                <h2 id="cccd-consent-title">Thêm thành viên bằng CCCD</h2>
                                <p>Chọn số người muốn thêm. Hệ thống sẽ yêu cầu đúng một ảnh CCCD cho mỗi người.</p>
                                <label className="cccd-member-count-field">
                                    <span>Số người muốn thêm</span>
                                    <select
                                        value={memberUploadCount}
                                        onChange={(event) => {
                                            setMemberUploadCount(Number(event.target.value));
                                            setMemberUploadError('');
                                        }}
                                        autoFocus
                                    >
                                        {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => (
                                            <option key={count} value={count}>
                                                {count} người
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                {memberUploadError && (
                                    <div className="cccd-member-count-error" role="alert">
                                        <AlertCircle size={15} />
                                        {memberUploadError}
                                    </div>
                                )}
                                <div className="cccd-consent-actions">
                                    <button type="button" className="cccd-consent-decline" onClick={declineCccdConsent}>
                                        Hủy
                                    </button>
                                    <button type="button" className="cccd-consent-accept" onClick={confirmMemberUploadCount}>
                                        Chọn {Math.min(10, Math.max(1, Math.trunc(memberUploadCount || 1)))} ảnh
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="cccd-consent-icon">
                                    <Camera size={24} />
                                </div>
                                <h2 id="cccd-consent-title">Chọn nguồn ảnh CCCD</h2>
                                <p>Chọn ảnh CCCD đã có trên máy hoặc chụp trực tiếp bằng camera.</p>
                                <div className="cccd-source-options">
                                    <button
                                        type="button"
                                        className="cccd-source-option"
                                        onClick={() => chooseCccdSource('file')}
                                        autoFocus
                                    >
                                        Tải ảnh từ máy
                                    </button>
                                    <button
                                        type="button"
                                        className="cccd-source-option"
                                        onClick={() => chooseCccdSource('camera')}
                                    >
                                        Chụp bằng camera
                                    </button>
                                </div>
                                <div className="cccd-consent-actions">
                                    <button type="button" className="cccd-consent-decline" onClick={declineCccdConsent}>
                                        Hủy
                                    </button>
                                </div>
                            </>
                        )}
                    </section>
                </div>
            )}

            {ocrNotice && (
                <div
                    className={`dktt-toast ocr-toast${/Trùng|Giới tính|Không đọc/.test(ocrNotice) ? ' error' : ''}`}
                    role="alert"
                >
                    {ocrNotice}
                </div>
            )}

            {declarationPreview && (
                <div className="xctt-declaration-backdrop" role="dialog" aria-modal="true" aria-labelledby="xctt-declaration-title">
                    <section className="xctt-declaration-modal">
                        <header className="xctt-declaration-header">
                            <h2 id="xctt-declaration-title">{declarationPreview.title}</h2>
                            <button
                                type="button"
                                className="xctt-declaration-close"
                                aria-label="Đóng"
                                onClick={closeDeclarationPreview}
                            >
                                <X size={20} />
                            </button>
                        </header>
                        <div className="xctt-declaration-preview">
                            <iframe title={declarationPreview.title} src={declarationPreview.url} />
                        </div>
                        <footer className="xctt-declaration-actions">
                            <button type="button" className="xctt-btn ghost" onClick={closeDeclarationPreview}>
                                Đóng
                            </button>
                            <a
                                className="xctt-btn primary"
                                href={declarationPreview.url}
                                download={declarationPreview.downloadName}
                            >
                                <Download size={18} />
                                Tải xuống
                            </a>
                        </footer>
                    </section>
                </div>
            )}

            {showSuccess && (
                <div
                    className="xctt-modal-backdrop"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="xctt-success-title"
                >
                    <div className="xctt-modal">
                        <button
                            type="button"
                            className="xctt-modal-close"
                            aria-label="Đóng"
                            onClick={() => setShowSuccess(false)}
                        >
                            <X size={20} />
                        </button>
                        <div className="xctt-modal-icon">✓</div>
                        <h2 id="xctt-success-title">Nộp hồ sơ thành công</h2>
                        <p>Hồ sơ xác nhận thông tin về cư trú đã được tiếp nhận ở chế độ mô phỏng.</p>
                        <strong>Mã hồ sơ: XCTT-2026-0001</strong>
                        <button type="button" className="xctt-btn primary" onClick={() => setShowSuccess(false)}>
                            Hoàn tất
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

interface SectionProps {
    id: string;
    number: number;
    title: string;
    open: boolean;
    onToggle: (id: string) => void;
    action?: React.ReactNode;
    children: React.ReactNode;
}

const XcttSection: React.FC<SectionProps> = ({ id, number, title, open, onToggle, action, children }) => (
    <div className={`dktt-section${open ? ' open' : ''}`} id={`section-${id}`}>
        <div
            className="dktt-section-header"
            onClick={() => onToggle(id)}
            role="button"
            tabIndex={0}
            aria-expanded={open}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onToggle(id);
                }
            }}
        >
            <div className="dktt-section-header-left">
                <span className="dktt-section-number">{number}</span>
                <h3 className="dktt-section-title">{title}</h3>
            </div>
            {action && <div className="dktt-section-header-action">{action}</div>}
            <ChevronDown size={20} className="dktt-section-chevron" />
        </div>
        <div className="dktt-section-body">{children}</div>
    </div>
);

const FieldGrid: React.FC<{
    fields: FieldConfig[];
    values: Record<string, string>;
    errors: Record<string, string>;
    onChange: (fieldId: string, value: string) => void;
    columns?: 2 | 4;
}> = ({ fields, values, errors, onChange, columns = 2 }) => (
    <div className={`xctt-grid cols-${columns}`}>
        {fields.map((field) => (
            <FieldControl
                key={field.id}
                field={field}
                value={values[field.id] || ''}
                error={errors[field.id]}
                onChange={(value) => onChange(field.id, value)}
            />
        ))}
    </div>
);

const ApplicantFieldGrid: React.FC<{
    fields: FieldConfig[];
    values: Record<string, string>;
    errors: Record<string, string>;
    onChange: (fieldId: string, value: string) => void;
}> = ({ fields, values, errors, onChange }) => {
    const birthTypeField = fields.find((field) => field.id === 'birthType');
    const birthDateField = fields.find((field) => field.id === 'birthDate');
    const displayFields = fields.filter((field) => field.id !== 'birthType' && field.id !== 'birthDate');

    return (
        <div className="xctt-grid cols-4">
            {displayFields.map((field) => (
                <React.Fragment key={field.id}>
                    <FieldControl
                        field={field}
                        value={values[field.id] || ''}
                        error={errors[field.id]}
                        onChange={(value) => onChange(field.id, value)}
                    />
                    {field.id === 'fullName' && birthTypeField && birthDateField && (
                        <BirthDateControl
                            birthTypeField={birthTypeField}
                            birthDateField={birthDateField}
                            values={values}
                            errors={errors}
                            onChange={onChange}
                        />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};

const BirthDateControl: React.FC<{
    birthTypeField: FieldConfig;
    birthDateField: FieldConfig;
    values: Record<string, string>;
    errors: Record<string, string>;
    onChange: (fieldId: string, value: string) => void;
}> = ({ birthTypeField, birthDateField, values, errors, onChange }) => (
    <div className="xctt-field xctt-birth-date-field span-2">
        <label htmlFor={birthDateField.id}>
            Ngày sinh <span>(*)</span>
        </label>
        <div className="xctt-birth-date-controls">
            <div className="xctt-select-shell">
                <select
                    id={birthTypeField.id}
                    value={values[birthTypeField.id] || ''}
                    onChange={(event) => onChange(birthTypeField.id, event.target.value)}
                >
                    <option value="">{birthTypeField.placeholder || 'Chọn'}</option>
                    {(birthTypeField.options || []).map((option) => (
                        <option value={option} key={option}>
                            {option}
                        </option>
                    ))}
                </select>
            </div>
            <div className="xctt-date-input-shell">
                <input
                    id={birthDateField.id}
                    type={
                        values[birthTypeField.id] === 'Năm'
                            ? 'number'
                            : values[birthTypeField.id] === 'Tháng năm'
                              ? 'month'
                              : 'date'
                    }
                    value={values[birthDateField.id] || ''}
                    placeholder={birthDateField.placeholder}
                    onChange={(event) => onChange(birthDateField.id, event.target.value)}
                />
                <Calendar size={18} aria-hidden="true" style={{ pointerEvents: 'none' }} />
            </div>
        </div>
        {(errors.birthType || errors.birthDate) && <p className="xctt-error">{errors.birthType || errors.birthDate}</p>}
    </div>
);

const FieldControl: React.FC<{
    field: FieldConfig;
    value: string;
    error?: string;
    onChange: (value: string) => void;
}> = ({ field, value, error, onChange }) => (
    <div className={`xctt-field ${field.span === 2 ? 'span-2' : ''} ${field.span === 3 ? 'span-3' : ''}`}>
        <label htmlFor={field.id}>
            {field.label} {field.required && <span>(*)</span>}
        </label>
        {field.kind === 'select' ? (
            <div className="xctt-select-shell">
                <select
                    id={field.id}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    disabled={field.readOnly || field.disabled}
                >
                    <option value="">{field.placeholder || 'Chọn'}</option>
                    {(field.options || []).map((option) => (
                        <option value={option} key={option}>
                            {option}
                        </option>
                    ))}
                </select>
                {value && !field.readOnly && !field.disabled && (
                    <button
                        type="button"
                        className="xctt-select-clear"
                        aria-label={`Xóa ${field.label}`}
                        onClick={() => onChange('')}
                    >
                        <X size={16} />
                    </button>
                )}
            </div>
        ) : field.kind === 'textarea' ? (
            <textarea
                id={field.id}
                value={value}
                placeholder={field.placeholder}
                disabled={field.readOnly || field.disabled}
                onChange={(event) => onChange(event.target.value)}
            />
        ) : (
            <input
                id={field.id}
                type={field.kind}
                value={field.readOnly ? field.placeholder || value : value}
                placeholder={field.placeholder}
                readOnly={field.readOnly}
                disabled={field.readOnly || field.disabled}
                onChange={(event) => onChange(event.target.value)}
            />
        )}
        {error && <p className="xctt-error">{error}</p>}
        {field.isAutofilled && !error && (
            <span
                className="form-hint"
                style={{ color: 'var(--accent)', fontSize: '13px', marginTop: '4px', display: 'block' }}
            >
                ✓ Đã tự động điền
            </span>
        )}
    </div>
);

const FamilyMemberTable: React.FC<{
    members: FamilyMember[];
    errors: Record<string, string>;
    onAdd: () => void;
    onRemove: (id: number) => void;
    onChange: (id: number, key: keyof Omit<FamilyMember, 'id'>, value: string) => void;
    action?: React.ReactNode;
    cccdQueue: CccdQueueItem[];
    isReadingCccd: boolean;
    onClearCccdQueue: () => void;
}> = ({ members, errors, onAdd, onRemove, onChange, action, cccdQueue, isReadingCccd, onClearCccdQueue }) => (
    <div style={{ marginTop: 28 }}>
        <div className="dktt-table-caption">
            <div className="dktt-sub-title" style={{ margin: 0, borderBottom: 'none' }}>
                Những thành viên trong hộ gia đình cùng thay đổi
            </div>
            <div className="dktt-table-caption-actions">
                <span className="dktt-badge dktt-badge-soft">Tùy chọn</span>
                {action}
            </div>
        </div>
        {cccdQueue.length > 0 && (
            <div className="cccd-upload-queue" aria-live="polite">
                <div className="cccd-upload-queue-header">
                    <div>
                        <strong>Hàng đợi CCCD</strong>
                        <span>
                            {cccdQueue.filter((item) => item.status === 'success').length}/{cccdQueue.length} tệp hoàn tất
                        </span>
                    </div>
                    {!isReadingCccd && (
                        <button type="button" onClick={onClearCccdQueue} aria-label="Đóng hàng đợi">
                            ×
                        </button>
                    )}
                </div>
                <div className="cccd-upload-queue-list">
                    {cccdQueue.map((item, index) => (
                        <div key={item.id} className={`cccd-upload-queue-item ${item.status}`}>
                            <span className="cccd-upload-queue-icon">
                                {item.status === 'processing' && <LoaderCircle size={16} className="cccd-queue-spinner" />}
                                {item.status === 'success' && <CheckCircle2 size={16} />}
                                {item.status === 'error' && <AlertCircle size={16} />}
                                {item.status === 'waiting' && <Files size={16} />}
                            </span>
                            <span className="cccd-upload-queue-copy">
                                <strong>
                                    {index + 1}. {item.fileName}
                                </strong>
                                <small>{item.message}</small>
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        )}
        <div className="dktt-member-table-wrapper">
            <table className="dktt-member-table">
                <thead>
                    <tr>
                        <th className="col-action">Thao tác</th>
                        <th className="col-stt">STT</th>
                        <th>
                            Họ và tên <span className="req">(*)</span>
                        </th>
                        <th>
                            Ngày sinh <span className="req">(*)</span>
                        </th>
                        <th>
                            Giới tính <span className="req">(*)</span>
                        </th>
                        <th>
                            Số ĐDCN (CCCD) <span className="req">(*)</span>
                        </th>
                        <th>
                            Quan hệ với chủ hộ <span className="req">(*)</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {members.map((member, index) => {
                        const errorStyle = (field: keyof Omit<FamilyMember, 'id'>) =>
                            errors[`member-${member.id}-${field}`]
                                ? { borderColor: 'var(--danger)', background: 'var(--danger-subtle)' }
                                : {};

                        return (
                            <tr key={member.id}>
                                <td className="col-action">
                                    {index === 0 ? (
                                        <button
                                            type="button"
                                            className="dktt-btn-add"
                                            onClick={onAdd}
                                            title="Thêm thành viên"
                                        >
                                            +
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            className="dktt-btn-remove"
                                            onClick={() => onRemove(member.id)}
                                            title="Xóa dòng này"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </td>
                                <td className="col-stt">{index + 1}</td>
                                <td>
                                    <input
                                        className="dktt-table-input"
                                        type="text"
                                        value={member.hoTen}
                                        onChange={(event) => onChange(member.id, 'hoTen', event.target.value)}
                                        placeholder="Họ và tên"
                                        style={errorStyle('hoTen')}
                                    />
                                </td>
                                <td>
                                    <input
                                        className="dktt-table-input"
                                        type="date"
                                        value={member.ngaySinh}
                                        onChange={(event) => onChange(member.id, 'ngaySinh', event.target.value)}
                                        style={errorStyle('ngaySinh')}
                                    />
                                </td>
                                <td>
                                    <select
                                        className="dktt-table-select"
                                        value={member.gioiTinh}
                                        onChange={(event) => onChange(member.id, 'gioiTinh', event.target.value)}
                                        style={errorStyle('gioiTinh')}
                                    >
                                        <option value="">-- Chọn --</option>
                                        {genderOptions.map((gender) => (
                                            <option key={gender} value={gender}>
                                                {gender}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td>
                                    <input
                                        className="dktt-table-input"
                                        type="text"
                                        maxLength={12}
                                        value={member.cccd}
                                        onChange={(event) => onChange(member.id, 'cccd', event.target.value)}
                                        placeholder="12 chữ số"
                                        style={errorStyle('cccd')}
                                    />
                                </td>
                                <td>
                                    <select
                                        className="dktt-table-select"
                                        value={member.quanHe}
                                        onChange={(event) => onChange(member.id, 'quanHe', event.target.value)}
                                        style={errorStyle('quanHe')}
                                    >
                                        <option value="">-- Chọn --</option>
                                        {relationOptions.map((rel) => (
                                            <option key={rel} value={rel}>
                                                {rel}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
        <p className="dktt-note" style={{ marginTop: 8 }}>
            Bảng này chỉ cần khai khi có thêm nhân khẩu cùng thay đổi thường trú. Nếu đã nhập một dòng thì cần điền đủ
            toàn bộ cột bắt buộc của dòng đó.
        </p>
    </div>
);

const MockTagSelect: React.FC<{ label: string; value: string; onClear: () => void }> = ({ label, value, onClear }) => (
    <div className="xctt-field span-2">
        <label>{label}</label>
        <div className="xctt-tag-select">
            <span>
                <button type="button" onClick={onClear}>
                    ×
                </button>
                {value}
            </span>
            <button type="button" onClick={onClear} aria-label="Xóa lựa chọn">
                ×
            </button>
        </div>
    </div>
);

export default XacNhanCuTruPage;
