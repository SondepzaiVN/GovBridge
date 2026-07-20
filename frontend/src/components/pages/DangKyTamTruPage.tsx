import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    AlertCircle,
    ArrowLeft,
    Bot,
    Camera,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    FileDown,
    FileText,
    Files,
    HelpCircle,
    Home,
    LoaderCircle,
    Paperclip,
    Plus,
    Save,
    Send,
    ShieldCheck,
    Trash2,
} from 'lucide-react';
import { administrativeUnitService } from '../../api/administrativeUnitService';
import { ocrService } from '../../api/aiServices';
import { useForm } from '../../contexts/FormContext';
import { ROUTE_TO_SERVICE_MAP } from '../../data/services';
import {
    dateFormatOptions,
    dossierCases,
    ethnicityOptions,
    fieldHelp,
    genderOptions,
    notificationMethods,
    procedureCasesByType,
    procedureTypes,
    relationshipOptions,
    religionOptions,
    resultMethods,
} from '../../data/tamTruMockData';
import type { CCCDInfo, FormFieldOption } from '../../types';
import {
    validateTamTruApplication,
    type TamTruApplicationData,
    type TamTruAttachmentDraft,
    type TamTruHouseholdMember,
    type TamTruReviewResult,
} from '../../utils/validateTamTruApplication';
import {
    clearSubmissionId,
    getOrCreateSubmissionId,
    saveApplicationToDashboard,
    type DashboardDocument,
} from '../../utils/dashboardSync';
import { saveAttachmentFile } from '../../utils/attachmentStorage';
import { isLikelyConnectivityError, notifyConnectivityFallback } from '../../utils/connectivityFallback';
import { reviewUploadedDocument } from '../../utils/attachmentDocumentReview';
import { addFormFillAppliedListener } from '../../utils/formFillBridge';
import { AttachmentReviewBadge } from '../common/AttachmentReviewBadge';
import { MissingRequiredFieldsModal } from '../common/MissingRequiredFieldsModal';
import type { ResidenceFieldSuggestion } from '../../utils/residenceCccdSuggestions';

const CT01_TEMPLATE_URL = 'https://cdn.thuvienphapluat.vn/uploads/mst/images/DoanTien/CT01-mau.docx';

const addYears = (date: Date, years: number) => {
    const next = new Date(date);
    next.setFullYear(next.getFullYear() + years);
    return next.toISOString().slice(0, 10);
};

const createBlankMember = (id: number): TamTruHouseholdMember => ({
    id,
    fullName: '',
    dateFormat: 'day-month-year',
    dateOfBirth: '',
    gender: '',
    citizenId: '',
    relationshipWithHead: '',
});

const createInitialAttachments = (): Record<string, TamTruAttachmentDraft> => {
    const drafts: Record<string, TamTruAttachmentDraft> = {};
    dossierCases.forEach((dossierCase) => {
        dossierCase.documents.forEach((document) => {
            if (drafts[document.id]) return;
            drafts[document.id] = {
                documentId: document.id,
                checked: document.required,
                fileName: '',
                quantity: document.quantity,
                note: '',
            };
        });
    });
    return drafts;
};

const initialForm: TamTruApplicationData = {
    receiveCityCode: '',
    receiveVillageCode: '',
    receiveOrgAddress: '',
    receiveOrgPhone: '',
    procedureTypeCode: 'dang-ky-tam-tru',
    procedureCaseCode: '',
    registrationMode: '',
    declareMode: 'proxy',
    fullName: '',
    dateFormat: 'day-month-year',
    dateOfBirth: '',
    gender: '',
    ethnicity: '',
    religion: '',
    citizenId: '',
    phoneNumber: '',
    email: '',
    temporaryCityCode: '',
    temporaryVillageCode: '',
    temporaryAddress: '',
    householderName: '',
    householderCitizenId: '',
    householderRelationship: '',
    requestContent: '',
    temporaryUntilDate: addYears(new Date(), 2),
    householdMembers: [createBlankMember(1)],
    selectedDossierCaseId: '',
    attachmentDrafts: createInitialAttachments(),
    notificationMethod: 'portal',
    resultMethod: 'truc-tiep',
    feeType: 'co-phi',
    feeAmount: '7000',
    feeExemptionReason: '',
    feeDescription: 'Thu lệ phí Đăng ký tạm trú',
    committed: false,
};

const TAM_TRU_FORM_FILL_FIELD_IDS = new Set([
    'receiveCityCode',
    'receiveVillageCode',
    'receiveOrgAddress',
    'receiveOrgPhone',
    'procedureTypeCode',
    'procedureCaseCode',
    'registrationMode',
    'declareMode',
    'fullName',
    'dateFormat',
    'dateOfBirth',
    'gender',
    'ethnicity',
    'religion',
    'citizenId',
    'phoneNumber',
    'email',
    'temporaryCityCode',
    'temporaryVillageCode',
    'temporaryAddress',
    'householderName',
    'householderCitizenId',
    'householderRelationship',
    'requestContent',
    'temporaryUntilDate',
    'notificationMethod',
    'resultMethod',
    'feeType',
    'feeAmount',
    'feeExemptionReason',
    'feeDescription',
]);

const TAM_TRU_FORM_FILL_ORDER = new Map(
    [
        'receiveCityCode',
        'receiveVillageCode',
        'temporaryCityCode',
        'temporaryVillageCode',
        'temporaryAddress',
    ].map((fieldId, index) => [fieldId, index]),
);

const getSortedTamTruFillEntries = (fields: Record<string, string>) =>
    Object.entries(fields)
        .filter(([fieldId]) => TAM_TRU_FORM_FILL_FIELD_IDS.has(fieldId))
        .sort(([left], [right]) => (TAM_TRU_FORM_FILL_ORDER.get(left) ?? 100) - (TAM_TRU_FORM_FILL_ORDER.get(right) ?? 100));

const requiredFields = new Set([
    'receiveCityCode',
    'receiveVillageCode',
    'receiveOrgAddress',
    'procedureTypeCode',
    'procedureCaseCode',
    'fullName',
    'dateFormat',
    'dateOfBirth',
    'gender',
    'citizenId',
    'temporaryCityCode',
    'temporaryVillageCode',
    'temporaryAddress',
    'householderName',
    'householderCitizenId',
    'householderRelationship',
    'requestContent',
    'temporaryUntilDate',
    'resultMethod',
]);

const fieldLabels: Record<string, string> = {
    receiveCityCode: 'Tỉnh/Thành phố',
    receiveVillageCode: 'Xã/Phường/Đặc khu',
    receiveOrgAddress: 'Cơ quan đăng ký cư trú',
    receiveOrgPhone: 'Số điện thoại cơ quan',
    procedureTypeCode: 'Thủ tục',
    procedureCaseCode: 'Trường hợp',
    fullName: 'Họ và tên',
    dateFormat: 'Định dạng ngày sinh',
    dateOfBirth: 'Ngày tháng năm sinh',
    gender: 'Giới tính',
    ethnicity: 'Dân tộc',
    religion: 'Tôn giáo',
    citizenId: 'Số định danh cá nhân / Số ĐDCN / CCCD',
    phoneNumber: 'SĐT liên hệ',
    email: 'Email',
    temporaryCityCode: 'Tỉnh/Thành phố',
    temporaryVillageCode: 'Xã/Phường/Đặc khu',
    temporaryAddress: 'Địa chỉ (số nhà, đường phố, thôn, xóm, làng, ấp, bản, buôn, phum, sóc)',
    householderName: 'Họ tên chủ hộ tạm trú',
    householderCitizenId: 'Số ĐDCN chủ hộ tạm trú',
    householderRelationship: 'Quan hệ với chủ hộ tạm trú',
    requestContent: 'Nội dung đề nghị',
    temporaryUntilDate: 'Thời hạn tạm trú đề nghị đến ngày',
    resultMethod: 'Hình thức nhận kết quả',
    feeAmount: 'Lệ phí',
    feeExemptionReason: 'Lý do miễn lệ phí',
    feeDescription: 'Mô tả',
};

const Section: React.FC<{ number: number; title: string; action?: React.ReactNode; children: React.ReactNode }> = ({
    number,
    title,
    action,
    children,
}) => (
    <section className="dktt-section open">
        <div className="dktt-section-header">
            <div className="dktt-section-header-left">
                <span className="dktt-section-number">{number}</span>
                <h3 className="dktt-section-title">{title}</h3>
            </div>
            {action && <div className="dktt-section-header-action">{action}</div>}
        </div>
        <div className="dktt-section-body">{children}</div>
    </section>
);

const helpButton = (fieldId: string, activeHelp: string, setActiveHelp: (fieldId: string) => void) => (
    <button
        type="button"
        className="tamtru-help-btn"
        title={fieldHelp[fieldId]}
        onClick={() => setActiveHelp(activeHelp === fieldId ? '' : fieldId)}
    >
        <HelpCircle size={15} />
    </button>
);

const findOptionByName = (options: FormFieldOption[], includes: string[]) =>
    options.find((option) => includes.every((item) => option.label.toLowerCase().includes(item.toLowerCase()))) || null;

const agencyNameFromWard = (wardLabel: string) => (wardLabel ? `Công an ${wardLabel}` : '');
type TamTruCccdTarget = 'applicant' | 'householder' | 'member';
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

const isBlankMember = (member: TamTruHouseholdMember) =>
    !member.fullName &&
    !member.dateOfBirth &&
    !member.gender &&
    !member.citizenId &&
    !member.relationshipWithHead;

const DangKyTamTruPage: React.FC = () => {
    const navigate = useNavigate();
    const { formState } = useForm();
    const cccdInputRef = useRef<HTMLInputElement>(null);
    const cccdCameraInputRef = useRef<HTMLInputElement>(null);
    const cccdTargetRef = useRef<TamTruCccdTarget>('applicant');
    const expectedMemberFileCountRef = useRef(1);
    const service = ROUTE_TO_SERVICE_MAP['/dang-ky-tam-tru'] || {
        requiredDocs: [],
        steps: [],
        processingTime: '',
        fee: '',
        category: '',
    };
    const [form, setForm] = useState<TamTruApplicationData>(initialForm);
    const [provinceOptions, setProvinceOptions] = useState<FormFieldOption[]>([]);
    const [receiveWardOptions, setReceiveWardOptions] = useState<FormFieldOption[]>([]);
    const [temporaryWardOptions, setTemporaryWardOptions] = useState<FormFieldOption[]>([]);
    const [administrativeError, setAdministrativeError] = useState('');
    const [review, setReview] = useState<TamTruReviewResult | null>(null);
    const [toast, setToast] = useState('');
    const [isSubmittingApplication, setIsSubmittingApplication] = useState(false);
    const [showMissingRequiredModal, setShowMissingRequiredModal] = useState(false);
    const [activeDossierCaseId, setActiveDossierCaseId] = useState(dossierCases[0]?.id || '');
    const [memberCounter, setMemberCounter] = useState(2);
    const [activeHelp, setActiveHelp] = useState('');
    const [isReadingCccd, setIsReadingCccd] = useState(false);
    const [cccdDialogStep, setCccdDialogStep] = useState<CccdDialogStep | null>(null);
    const [pendingCccdTarget, setPendingCccdTarget] = useState<TamTruCccdTarget>('applicant');
    const [memberUploadCount, setMemberUploadCount] = useState(1);
    const [memberUploadError, setMemberUploadError] = useState('');
    const [cccdQueue, setCccdQueue] = useState<CccdQueueItem[]>([]);
    const [pendingResidenceSuggestion, setPendingResidenceSuggestion] =
        useState<ResidenceFieldSuggestion | null>(null);

    const procedureCases = procedureCasesByType[form.procedureTypeCode] || [];
    const showRegistrationMode = form.procedureTypeCode === 'dang-ky-tam-tru';
    const updateField = <K extends keyof TamTruApplicationData>(field: K, value: TamTruApplicationData[K]) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setReview(null);
        setShowMissingRequiredModal(false);
    };

    const showToast = (message: string) => {
        setToast(message);
        window.setTimeout(() => setToast(''), 3200);
    };

    useEffect(() => {
        const ocrFields: Partial<TamTruApplicationData> = {};
        (['fullName', 'dateOfBirth', 'gender', 'citizenId'] as const).forEach((fieldId) => {
            const value = formState.values[fieldId];
            if (formState.touched[fieldId] && value && form[fieldId] !== value) {
                ocrFields[fieldId] = value;
            }
        });

        if (Object.keys(ocrFields).length === 0) return;

        const syncTimer = window.setTimeout(() => {
            setForm((prev) => ({ ...prev, ...ocrFields }));
            setReview(null);
        }, 0);

        return () => window.clearTimeout(syncTimer);
    }, [
        form.citizenId,
        form.dateOfBirth,
        form.fullName,
        form.gender,
        formState.touched,
        formState.values,
    ]);

    useEffect(() => {
        const controller = new AbortController();
        administrativeUnitService
            .getProvinces(controller.signal)
            .then((options) => {
                setProvinceOptions(options);
                setAdministrativeError('');
            })
            .catch((error: unknown) => {
                if (error instanceof DOMException && error.name === 'AbortError') return;
                setAdministrativeError('Không tải được danh sách tỉnh/thành phố. Vui lòng thử lại.');
            });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!form.receiveCityCode) {
            return;
        }

        const controller = new AbortController();
        administrativeUnitService
            .getWards(form.receiveCityCode, controller.signal)
            .then((options) => {
                setReceiveWardOptions(options);
                setAdministrativeError('');
            })
            .catch((error: unknown) => {
                if (error instanceof DOMException && error.name === 'AbortError') return;
                setReceiveWardOptions([]);
                setAdministrativeError('Không tải được danh sách xã/phường của cơ quan thực hiện.');
            });
        return () => controller.abort();
    }, [form.receiveCityCode]);

    useEffect(() => {
        if (!form.temporaryCityCode) {
            return;
        }

        const controller = new AbortController();
        administrativeUnitService
            .getWards(form.temporaryCityCode, controller.signal)
            .then((options) => {
                setTemporaryWardOptions(options);
                setAdministrativeError('');
            })
            .catch((error: unknown) => {
                if (error instanceof DOMException && error.name === 'AbortError') return;
                setTemporaryWardOptions([]);
                setAdministrativeError('Không tải được danh sách xã/phường nơi tạm trú.');
            });
        return () => controller.abort();
    }, [form.temporaryCityCode]);

    const getProvinceLabel = (code: string) => provinceOptions.find((item) => item.value === code)?.label || '';
    const getReceiveWardLabel = (code: string) => receiveWardOptions.find((item) => item.value === code)?.label || '';
    const getTemporaryWardLabel = (code: string) =>
        temporaryWardOptions.find((item) => item.value === code)?.label || '';

    const buildRequestContent = (wardCode: string, provinceCode: string) => {
        const wardLabel = getTemporaryWardLabel(wardCode);
        const provinceLabel = getProvinceLabel(provinceCode);
        return wardLabel && provinceLabel ? `Đăng ký tạm trú tại ${wardLabel} - ${provinceLabel}` : '';
    };

    const getFillLabel = (value: string, label: string) => {
        if (label) return label;
        return /^\d+$/.test(value) ? '' : value;
    };

    const applyFillEntry = (current: TamTruApplicationData, fieldId: string, value: string): TamTruApplicationData => {
        if (fieldId === 'receiveCityCode') {
            return {
                ...current,
                receiveCityCode: value,
                receiveVillageCode: '',
                receiveOrgAddress: '',
                receiveOrgPhone: '',
            };
        }

        if (fieldId === 'receiveVillageCode') {
            const wardLabel = getFillLabel(value, getReceiveWardLabel(value));
            return {
                ...current,
                receiveVillageCode: value,
                receiveOrgAddress: wardLabel ? agencyNameFromWard(wardLabel) : current.receiveOrgAddress,
                receiveOrgPhone: '',
            };
        }

        if (fieldId === 'temporaryCityCode') {
            return {
                ...current,
                temporaryCityCode: value,
                temporaryVillageCode: '',
                requestContent: current.requestContent.startsWith('Đăng ký tạm trú tại') ? '' : current.requestContent,
            };
        }

        if (fieldId === 'temporaryVillageCode') {
            const wardLabel = getFillLabel(value, getTemporaryWardLabel(value));
            const provinceLabel = getProvinceLabel(current.temporaryCityCode);
            const nextContent = wardLabel && provinceLabel
                ? `Đăng ký tạm trú tại ${wardLabel} - ${provinceLabel}`
                : buildRequestContent(value, current.temporaryCityCode);
            return {
                ...current,
                temporaryVillageCode: value,
                requestContent:
                    !current.requestContent || current.requestContent.startsWith('Đăng ký tạm trú tại')
                        ? nextContent
                        : current.requestContent,
            };
        }

        if (fieldId === 'procedureTypeCode') {
            const nextCases = procedureCasesByType[value] || [];
            return {
                ...current,
                procedureTypeCode: value,
                procedureCaseCode: nextCases[0]?.value || current.procedureCaseCode,
            };
        }

        return {
            ...current,
            [fieldId]: value,
        };
    };

    useEffect(() => addFormFillAppliedListener(({ fields }) => {
        const entries = getSortedTamTruFillEntries(fields);
        if (entries.length === 0) return;

        setForm((current) =>
            entries.reduce(
                (nextForm, [fieldId, value]) => applyFillEntry(nextForm, fieldId, value),
                current,
            ),
        );
        setReview(null);
        setShowMissingRequiredModal(false);
    }), [receiveWardOptions, temporaryWardOptions, provinceOptions]);

    const handleReceiveProvinceChange = (code: string) => {
        setForm((prev) => ({
            ...prev,
            receiveCityCode: code,
            receiveVillageCode: '',
            receiveOrgAddress: '',
            receiveOrgPhone: '',
        }));
        setReceiveWardOptions([]);
        setReview(null);
    };

    const handleReceiveWardChange = (code: string) => {
        const wardLabel = getReceiveWardLabel(code);
        setForm((prev) => ({
            ...prev,
            receiveVillageCode: code,
            receiveOrgAddress: agencyNameFromWard(wardLabel),
            receiveOrgPhone: '',
        }));
        setReview(null);
    };

    const handleTemporaryProvinceChange = (code: string) => {
        setForm((prev) => ({
            ...prev,
            temporaryCityCode: code,
            temporaryVillageCode: '',
            requestContent: prev.requestContent.startsWith('Đăng ký tạm trú tại') ? '' : prev.requestContent,
        }));
        setTemporaryWardOptions([]);
        setReview(null);
    };

    const handleTemporaryWardChange = (code: string) => {
        setForm((prev) => {
            const nextContent = buildRequestContent(code, prev.temporaryCityCode);
            return {
                ...prev,
                temporaryVillageCode: code,
                requestContent:
                    !prev.requestContent || prev.requestContent.startsWith('Đăng ký tạm trú tại')
                        ? nextContent
                        : prev.requestContent,
            };
        });
        setReview(null);
    };

    const handleProcedureChange = (code: string) => {
        const nextCases = procedureCasesByType[code] || [];
        setForm((prev) => ({
            ...prev,
            procedureTypeCode: code,
            procedureCaseCode: '',
            registrationMode: code === 'dang-ky-tam-tru' ? 'lap-ho-moi' : '',
        }));
        if (nextCases.length === 1) updateField('procedureCaseCode', nextCases[0].value);
    };

    const selectDossierCase = (caseId: string) => {
        const dossierCase = dossierCases.find((item) => item.id === caseId);
        setActiveDossierCaseId(caseId);
        setForm((prev) => {
            const nextDrafts = { ...prev.attachmentDrafts };
            dossierCase?.documents.forEach((document) => {
                nextDrafts[document.id] = {
                    ...nextDrafts[document.id],
                    checked: nextDrafts[document.id]?.checked || document.required,
                    quantity: nextDrafts[document.id]?.quantity || document.quantity,
                };
            });
            return { ...prev, selectedDossierCaseId: caseId, attachmentDrafts: nextDrafts };
        });
        setReview(null);
    };

    const updateAttachment = (documentId: string, patch: Partial<TamTruAttachmentDraft>) => {
        setForm((prev) => ({
            ...prev,
            attachmentDrafts: {
                ...prev.attachmentDrafts,
                [documentId]: {
                    ...prev.attachmentDrafts[documentId],
                    documentId,
                    ...patch,
                },
            },
        }));
        setReview(null);
    };

    const updateAttachmentFile = (documentId: string, file: File | undefined, quantity: string) => {
        if (!file) return;
        const reviewDocument = dossierCases
            .flatMap((dossierCase) => dossierCase.documents)
            .find((document) => document.id === documentId);
        updateAttachment(documentId, {
            checked: true,
            file,
            fileName: file.name,
            quantity,
        });
        void reviewUploadedDocument({
            file,
            label: reviewDocument?.name || documentId.toUpperCase(),
            currentRoute: '/dang-ky-tam-tru',
            ...(documentId === 'ct01' ? { documentType: 'ct01' as const } : {}),
            onStatusChange: (documentReview) => updateAttachment(documentId, { documentReview }),
        });
    };

    const updateMember = (id: number, patch: Partial<TamTruHouseholdMember>) => {
        setForm((prev) => ({
            ...prev,
            householdMembers: prev.householdMembers.map((member) =>
                member.id === id ? { ...member, ...patch } : member,
            ),
        }));
        setReview(null);
    };

    const addMember = () => {
        setForm((prev) => ({
            ...prev,
            householdMembers: [...prev.householdMembers, createBlankMember(memberCounter)],
        }));
        setMemberCounter((prev) => prev + 1);
    };

    const removeMember = (id: number) => {
        setForm((prev) => ({
            ...prev,
            householdMembers:
                prev.householdMembers.length <= 1
                    ? prev.householdMembers
                    : prev.householdMembers.filter((member) => member.id !== id),
        }));
    };

    const applyCccdToApplicant = (info: CCCDInfo) => {
        setForm((prev) => ({
            ...prev,
            fullName: info.hoTen || prev.fullName,
            dateFormat: 'day-month-year',
            dateOfBirth: info.ngaySinh || prev.dateOfBirth,
            gender: normalizeGenderFromCccd(info.gioiTinh) || prev.gender,
            citizenId: info.id || prev.citizenId,
        }));
        setReview(null);
    };

    const buildReceiveAgencySuggestion = (): ResidenceFieldSuggestion | null => {
        if (!form.temporaryCityCode || !form.temporaryVillageCode) return null;
        if (form.receiveCityCode || form.receiveVillageCode || form.receiveOrgAddress) return null;

        const provinceLabel = getProvinceLabel(form.temporaryCityCode);
        const wardLabel = getTemporaryWardLabel(form.temporaryVillageCode);
        if (!provinceLabel || !wardLabel) return null;

        return {
            id: 'tam-tru-receive-agency-from-temporary-address',
            title: 'Gợi ý cơ quan tiếp nhận theo nơi tạm trú?',
            description: `Bạn đã chọn nơi tạm trú tại ${wardLabel}, ${provinceLabel}.`,
            fields: {
                receiveCityCode: form.temporaryCityCode,
                receiveVillageCode: form.temporaryVillageCode,
                receiveOrgAddress: agencyNameFromWard(wardLabel),
            },
            fieldLabels: {
                receiveCityCode: 'Tỉnh/Thành phố cơ quan thực hiện',
                receiveVillageCode: 'Xã/Phường cơ quan thực hiện',
                receiveOrgAddress: 'Cơ quan đăng ký cư trú',
            },
            displayValues: {
                receiveCityCode: provinceLabel,
                receiveVillageCode: wardLabel,
                receiveOrgAddress: agencyNameFromWard(wardLabel),
            },
        };
    };

    const acceptResidenceSuggestion = () => {
        if (!pendingResidenceSuggestion) return;
        setForm((prev) => ({ ...prev, ...pendingResidenceSuggestion.fields }));
        setReview(null);
        setPendingResidenceSuggestion(null);
        showToast('Đã áp dụng cơ quan tiếp nhận theo địa bàn tạm trú.');
    };

    const applyCccdToHouseholder = (info: CCCDInfo) => {
        setForm((prev) => ({
            ...prev,
            householderName: info.hoTen || prev.householderName,
            householderCitizenId: info.id || prev.householderCitizenId,
        }));
        setReview(null);
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
        if (target === 'applicant' || target === 'householder') {
            const file = files[0];
            try {
                const resizedFile = await ocrService.resizeImage(file);
                const info = await ocrService.extractCCCDInfo(resizedFile, { showProcessingNotice: false });
                if (target === 'applicant') {
                    applyCccdToApplicant(info);
                    const suggestion = buildReceiveAgencySuggestion();
                    if (suggestion) {
                        setPendingResidenceSuggestion(suggestion);
                        showToast('Đã điền thông tin định danh từ CCCD. Vui lòng xác nhận cơ quan tiếp nhận gợi ý.');
                        return;
                    }
                    showToast('Đã điền thông tin người đề nghị từ CCCD.');
                } else {
                    applyCccdToHouseholder(info);
                    showToast('Đã điền thông tin chủ hộ từ CCCD.');
                }
            } catch (error) {
                console.error('Không đọc được CCCD cho mục tạm trú:', error);
                showToast('Không đọc được CCCD. Vui lòng thử lại ảnh rõ hơn.');
            } finally {
                setIsReadingCccd(false);
            }
            return;
        }

        let nextMembers = form.householdMembers.map((member) => ({ ...member }));
        let nextMemberCounter = memberCounter;
        let addedCount = 0;

        for (const [index, file] of files.entries()) {
            const queueItem = queueItems[index];
            updateQueueItem(queueItem.id, 'processing', 'VNPT AI đang đọc CCCD...');

            try {
                const resizedFile = await ocrService.resizeImage(file);
                const info = await ocrService.extractCCCDInfo(resizedFile, { showProcessingNotice: false });
                const citizenId = normalizeCccdNumber(info.id || '');
                const duplicatedMember = Boolean(
                    citizenId &&
                        (normalizeCccdNumber(form.citizenId) === citizenId ||
                            nextMembers.some((member) => normalizeCccdNumber(member.citizenId) === citizenId)),
                );

                if (duplicatedMember) {
                    updateQueueItem(queueItem.id, 'error', 'CCCD đã có trong danh sách');
                    continue;
                }

                const cccdMember: Omit<TamTruHouseholdMember, 'id'> = {
                    fullName: info.hoTen || '',
                    dateFormat: 'day-month-year',
                    dateOfBirth: info.ngaySinh || '',
                    gender: normalizeGenderFromCccd(info.gioiTinh),
                    citizenId,
                    relationshipWithHead: '',
                };
                const blankMemberIndex = nextMembers.findIndex(isBlankMember);

                if (blankMemberIndex >= 0) {
                    nextMembers[blankMemberIndex] = {
                        ...nextMembers[blankMemberIndex],
                        ...cccdMember,
                    };
                } else {
                    nextMembers.push({ id: nextMemberCounter, ...cccdMember });
                    nextMemberCounter += 1;
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
            setForm((prev) => ({
                ...prev,
                householdMembers: nextMembers,
            }));
            setMemberCounter(nextMemberCounter);
            setReview(null);
            showToast(`Đã tự động điền ${addedCount}/${files.length} thành viên từ CCCD.`);
        } else {
            showToast('Chưa có ảnh CCCD nào được xử lý thành công.');
        }

        setIsReadingCccd(false);
    };

    const openCccdFilePicker = (source: 'file' | 'camera') => {
        if (source === 'camera') {
            if (cccdCameraInputRef.current) cccdCameraInputRef.current.value = '';
            cccdCameraInputRef.current?.click();
            return;
        }
        if (cccdInputRef.current) cccdInputRef.current.value = '';
        cccdInputRef.current?.click();
    };

    const openSectionCccdCamera = (target: TamTruCccdTarget) => {
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

    const renderCccdHeaderAction = (target: TamTruCccdTarget, label: string) => (
        <button
            type="button"
            className="dktt-section-camera-btn"
            onClick={(event) => {
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

    const runReview = () => {
        const result = validateTamTruApplication(form);
        setReview(result);
        return result;
    };

    const handleSubmit = async () => {
        if (isSubmittingApplication) return;
        setShowMissingRequiredModal(false);
        const result = runReview();
        if (result.status === 'INVALID') {
            setShowMissingRequiredModal(true);
            return;
        }

        setIsSubmittingApplication(true);
        try {
            const submissionId = getOrCreateSubmissionId('dang-ky-tam-tru');
            const extractedDocs: DashboardDocument[] = [];
            const allFilesToUpload: File[] = [];
            Object.values(form.attachmentDrafts).forEach((draft) => {
                if (draft.checked) {
                    if (draft.fileName) {
                        extractedDocs.push({ name: draft.fileName, state: 'Đã có' });
                    }
                    if (draft.file) {
                        allFilesToUpload.push(draft.file);
                    }
                }
            });

            const attachments = await Promise.all(allFilesToUpload.map((file) => saveAttachmentFile(file)));

            let aggregatedOfficerNote = '';
            let finalFlag = '';
            Object.values(form.attachmentDrafts).forEach((draft) => {
                if (draft.checked && draft.documentReview?.text) {
                    aggregatedOfficerNote += `[${draft.fileName}]: ${draft.documentReview.text}\n\n`;
                    if (draft.documentReview.flag === 'red') {
                        finalFlag = 'red';
                    } else if (!finalFlag && draft.documentReview.flag) {
                        finalFlag = draft.documentReview.flag;
                    }
                }
            });

            await saveApplicationToDashboard({
                clientSubmissionId: submissionId,
                procedure: 'Đăng ký tạm trú',
                applicant: form.fullName || '',
                citizenId: form.citizenId || '',
                phone: form.phoneNumber || '',
                email: form.email || '',
                documents: extractedDocs,
                message: form.requestContent || 'Điền thiếu',
                caseNote: 'Tạm trú',
                details: {
                    'Tỉnh/Thành phố tạm trú': form.temporaryCityCode || '',
                    'Phường/Xã tạm trú': form.temporaryVillageCode || '',
                    'Địa chỉ tạm trú': form.temporaryAddress || '',
                    'Đến ngày': form.temporaryUntilDate || '',
                    'Chủ hộ': form.householderName || '',
                    'Quan hệ với chủ hộ': form.householderRelationship || '',
                    'Trường hợp': form.procedureCaseCode || '',
                    'Cơ quan thực hiện': form.receiveOrgAddress || '',
                },
                officerNote: aggregatedOfficerNote.trim(),
                officerNoteFlag: finalFlag,
                attachments,
            });

            clearSubmissionId('dang-ky-tam-tru');
            showToast('Nộp hồ sơ thành công.');
        } catch (error) {
            console.error('Không thể xác nhận nộp hồ sơ tạm trú.', error);
            if (isLikelyConnectivityError(error)) {
                notifyConnectivityFallback({ playAudio: true });
                showToast('Chưa xác nhận nộp hồ sơ do kết nối gián đoạn. Vui lòng kiểm tra mạng rồi gửi lại.');
            } else {
                showToast('Chưa thể nộp hồ sơ. Hệ thống chưa xác nhận đã nhận hồ sơ, vui lòng thử lại sau.');
            }
        } finally {
            setIsSubmittingApplication(false);
        }
    };

    const handleAutofill = async () => {
        let canTho = findOptionByName(provinceOptions, ['Cần Thơ']);
        if (!canTho && provinceOptions.length > 0) canTho = provinceOptions[0];

        let receiveWard =
            receiveWardOptions.find((item) => /Tân An|Ninh Kiều/i.test(item.label)) || receiveWardOptions[0] || null;
        let temporaryWard =
            temporaryWardOptions.find((item) => /Tân An|Ninh Kiều/i.test(item.label)) ||
            temporaryWardOptions[0] ||
            null;

        if (canTho && (!receiveWard || form.receiveCityCode !== canTho.value)) {
            try {
                const wards = await administrativeUnitService.getWards(canTho.value);
                setReceiveWardOptions(wards);
                setTemporaryWardOptions(wards);
                receiveWard = wards.find((item) => /Tân An|Ninh Kiều/i.test(item.label)) || wards[0] || null;
                temporaryWard = receiveWard;
            } catch {
                // Keep the existing options if the browser cannot reach the public API.
            }
        }

        const nextAttachments = createInitialAttachments();
        nextAttachments.ct01 = { ...nextAttachments.ct01, checked: true, fileName: 'ct01-demo.pdf', quantity: '1' };
        nextAttachments['residence-proof'] = {
            ...nextAttachments['residence-proof'],
            checked: true,
            fileName: 'giay-to-cho-o-hop-phap-demo.pdf',
            quantity: '1',
        };

        setForm({
            ...initialForm,
            receiveCityCode: canTho?.value || '',
            receiveVillageCode: receiveWard?.value || '',
            receiveOrgAddress: agencyNameFromWard(receiveWard?.label || ''),
            procedureTypeCode: 'dang-ky-tam-tru',
            procedureCaseCode: 'nhan-khau-ho',
            registrationMode: 'lap-ho-moi',
            declareMode: 'proxy',
            fullName: 'Nguyễn Văn A',
            dateOfBirth: '2000-01-01',
            gender: 'Nam',
            ethnicity: 'Kinh',
            religion: 'Không',
            citizenId: '012345678901',
            phoneNumber: '0901234567',
            email: 'email@example.com',
            temporaryCityCode: canTho?.value || '',
            temporaryVillageCode: temporaryWard?.value || '',
            temporaryAddress: '123 đường 3/2, phường Tân An, Thành phố Cần Thơ',
            householderName: 'Trần Văn B',
            householderRelationship: 'Chủ hộ',
            householderCitizenId: '136890989064',
            requestContent:
                temporaryWard && canTho
                    ? `Đăng ký tạm trú tại ${temporaryWard.label} - ${canTho.label}`
                    : 'Đăng ký tạm trú tại Phường Tân An - Thành phố Cần Thơ',
            temporaryUntilDate: addYears(new Date(), 2),
            selectedDossierCaseId: 'owned-legal-place',
            attachmentDrafts: nextAttachments,
            notificationMethod: 'portal',
            resultMethod: 'truc-tiep',
            feeType: 'co-phi',
            feeAmount: '7000',
            feeDescription: 'Thu lệ phí Đăng ký tạm trú',
            committed: false,
        });
        setActiveDossierCaseId('owned-legal-place');
        setReview(null);
        showToast('AI đã điền thử hồ sơ demo. Vui lòng tự tick cam kết trước khi nộp.');
    };

    const handleFeeTypeChange = (feeType: string) => {
        setForm((prev) => ({
            ...prev,
            feeType,
            feeAmount: feeType === 'co-phi' ? '7000' : '0',
            feeExemptionReason: feeType === 'co-phi' ? '' : prev.feeExemptionReason,
        }));
        setReview(null);
    };

    const renderHelpText = (fieldId: string) =>
        activeHelp === fieldId && <span className="tamtru-help-text">{fieldHelp[fieldId]}</span>;

    const renderInput = (
        field: keyof TamTruApplicationData,
        type = 'text',
        placeholder = '',
        maxLength?: number,
        readOnly = false,
        helpId?: string,
        isAutofilled = false,
    ) => (
        <div className="form-group">
            <label className="form-label" htmlFor={field}>
                {fieldLabels[field]}
                {requiredFields.has(field) && <span className="required"> *</span>}
                {helpId && helpButton(helpId, activeHelp, setActiveHelp)}
            </label>
            <input
                id={field}
                className="form-input"
                type={type}
                value={String(form[field])}
                placeholder={placeholder}
                maxLength={maxLength}
                readOnly={readOnly}
                disabled={readOnly}
                onChange={(event) => updateField(field, event.target.value as never)}
            />
            {helpId && renderHelpText(helpId)}
            {isAutofilled && (
                <span className="form-hint" style={{ color: 'var(--accent)' }}>
                    ✓ Đã tự động điền
                </span>
            )}
        </div>
    );

    const renderSelect = (
        field: keyof TamTruApplicationData,
        options: Array<{ value: string; label: string }> | string[],
        placeholder = '-- Chọn --',
        helpId?: string,
        onChange?: (value: string) => void,
        disabled = false,
    ) => (
        <div className="form-group">
            <label className="form-label" htmlFor={field}>
                {fieldLabels[field]}
                {requiredFields.has(field) && <span className="required"> *</span>}
                {helpId && helpButton(helpId, activeHelp, setActiveHelp)}
            </label>
            <select
                id={field}
                className="form-select"
                value={String(form[field])}
                disabled={disabled}
                onChange={(event) =>
                    onChange ? onChange(event.target.value) : updateField(field, event.target.value as never)
                }
            >
                <option value="">{placeholder}</option>
                {options.map((item) => {
                    const value = typeof item === 'string' ? item : item.value;
                    const label = typeof item === 'string' ? item : item.label;
                    return (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    );
                })}
            </select>
            {helpId && renderHelpText(helpId)}
        </div>
    );

    return (
        <div className="main-content dktt-main-content tamtru-page animate-slide-up">
            <nav className="breadcrumb" aria-label="Breadcrumb">
                <Link to="/">
                    <Home size={13} /> Trang chủ
                </Link>
                <ChevronRight size={13} className="breadcrumb-sep" />
                <span className="breadcrumb-link">Cư trú</span>
                <ChevronRight size={13} className="breadcrumb-sep" />
                <span aria-current="page">Đăng ký tạm trú</span>
            </nav>

            <div className="dktt-page-header">
                <h1>HỒ SƠ ĐĂNG KÝ TẠM TRÚ</h1>
                <p>GovBridge mô phỏng quy trình tạm trú phục vụ demo, không thay thế hệ thống chính thức.</p>
            </div>

            <div className="dktt-ai-hint">
                <span className="dktt-ai-hint-icon">
                    <img src="/logo_Gov_Bridge.jpg" alt="AI" />
                </span>
                <span>
                    <strong>Mẹo:</strong> Nhấn vào nút Trợ lý AI (góc phải) để tự động điền form bằng{' '}
                    <strong>giọng nói</strong> hoặc <strong>ảnh CCCD</strong>.
                </span>
            </div>

            <div className="dktt-required-note">
                <strong>Ghi chú:</strong> Các thông tin có dấu <span className="red">(*)</span> là thông tin bắt buộc
                phải nhập
            </div>

            <div className="tamtru-toolbar">
                <button type="button" className="btn btn-secondary" onClick={handleAutofill}>
                    <Bot size={16} />
                    AI điền thử hồ sơ
                </button>
            </div>
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

            <div className="tamtru-shell">
                <div className="tamtru-form">
                    <Section number={1} title="CƠ QUAN THỰC HIỆN">
                        {administrativeError && (
                            <p className="form-error-msg" role="alert">
                                {administrativeError}
                            </p>
                        )}
                        <div className="dktt-form-row">
                            {renderSelect(
                                'receiveCityCode',
                                provinceOptions,
                                'Chọn',
                                undefined,
                                handleReceiveProvinceChange,
                            )}
                            {renderSelect(
                                'receiveVillageCode',
                                receiveWardOptions,
                                'Chọn',
                                undefined,
                                handleReceiveWardChange,
                                !form.receiveCityCode,
                            )}
                            {renderInput(
                                'receiveOrgAddress',
                                'text',
                                'Cơ quan đăng ký cư trú',
                                undefined,
                                true,
                                undefined,
                                !!form.receiveOrgAddress,
                            )}
                            {renderInput(
                                'receiveOrgPhone',
                                'text',
                                'Số điện thoại cơ quan',
                                undefined,
                                true,
                                undefined,
                                !!form.receiveOrgPhone,
                            )}
                        </div>
                    </Section>

                    <Section number={2} title="THỦ TỤC HÀNH CHÍNH YÊU CẦU">
                        <div className="dktt-form-row cols-2">
                            {renderSelect(
                                'procedureTypeCode',
                                procedureTypes,
                                '-- Chọn --',
                                'procedureTypeCode',
                                handleProcedureChange,
                                true,
                            )}
                            {renderSelect('procedureCaseCode', procedureCases, '-- Chọn --', 'procedureCaseCode')}
                        </div>
                        {showRegistrationMode && (
                            <div className="tamtru-radio-line">
                                <label>
                                    <input
                                        type="radio"
                                        name="registrationMode"
                                        checked={form.registrationMode === 'lap-ho-moi'}
                                        onChange={() => updateField('registrationMode', 'lap-ho-moi')}
                                    />{' '}
                                    Đăng ký tạm trú lập hộ mới
                                </label>
                                <label>
                                    <input
                                        type="radio"
                                        name="registrationMode"
                                        checked={form.registrationMode === 'vao-ho-da-co'}
                                        onChange={() => updateField('registrationMode', 'vao-ho-da-co')}
                                    />{' '}
                                    Đăng ký tạm trú vào hộ đã có
                                </label>
                            </div>
                        )}
                    </Section>

                    <Section
                        number={3}
                        title="THÔNG TIN NGƯỜI ĐỀ NGHỊ ĐĂNG KÝ TẠM TRÚ"
                        action={renderCccdHeaderAction('applicant', 'Đọc CCCD cho người đề nghị')}
                    >
                        <div className="tamtru-choice-notes">
                            <label>
                                <input
                                    type="radio"
                                    name="declareMode"
                                    checked={form.declareMode === 'self'}
                                    onChange={() => updateField('declareMode', 'self')}
                                />
                                <span>
                                    <strong>Người khai thông tin là người Đăng ký tạm trú</strong>
                                    <small>
                                        Tự động điền các thông tin của chủ tài khoản được lấy từ dữ liệu dân cư.
                                    </small>
                                </span>
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="declareMode"
                                    checked={form.declareMode === 'proxy'}
                                    onChange={() => updateField('declareMode', 'proxy')}
                                />
                                <span>
                                    <strong>Khai hộ</strong>
                                    <small>
                                        Yêu cầu khai đúng các trường thông tin có trong cơ sở dữ liệu quốc gia về dân cư
                                        của người được khai hộ.
                                    </small>
                                </span>
                            </label>
                        </div>
                        <div className="dktt-form-row cols-2">
                            {renderInput('fullName', 'text', 'Họ tên')}
                            {renderSelect('dateFormat', dateFormatOptions)}
                            {renderInput('dateOfBirth', 'date')}
                            {renderSelect('gender', genderOptions)}
                            {renderSelect('ethnicity', ethnicityOptions)}
                            {renderSelect('religion', religionOptions)}
                            {renderInput('citizenId', 'text', 'Số định danh cá nhân', 12, false, 'citizenId')}
                            {renderInput('phoneNumber', 'tel', 'Số điện thoại')}
                            {renderInput('email', 'email', 'Email')}
                        </div>
                    </Section>

                    <Section
                        number={4}
                        title="THÔNG TIN ĐỀ NGHỊ ĐĂNG KÝ TẠM TRÚ"
                        action={renderCccdHeaderAction('householder', 'Đọc CCCD cho chủ hộ tạm trú')}
                    >
                        <div className="dktt-form-row cols-2">
                            {renderSelect(
                                'temporaryCityCode',
                                provinceOptions,
                                'Chọn',
                                undefined,
                                handleTemporaryProvinceChange,
                            )}
                            {renderSelect(
                                'temporaryVillageCode',
                                temporaryWardOptions,
                                'Chọn',
                                undefined,
                                handleTemporaryWardChange,
                                !form.temporaryCityCode,
                            )}
                            <div className="form-group full-width">
                                <label className="form-label" htmlFor="temporaryAddress">
                                    {fieldLabels.temporaryAddress} <span className="required">*</span>
                                </label>
                                <textarea
                                    id="temporaryAddress"
                                    className="form-textarea"
                                    placeholder="Địa chỉ đăng ký tạm trú"
                                    value={form.temporaryAddress}
                                    onChange={(event) => updateField('temporaryAddress', event.target.value)}
                                />
                            </div>
                            {renderInput('householderName', 'text', 'Họ tên chủ hộ tạm trú')}
                            {renderSelect(
                                'householderRelationship',
                                relationshipOptions,
                                '-- Chọn --',
                                'householderRelationship',
                            )}
                            {renderInput('householderCitizenId', 'text', 'Số định danh cá nhân chủ hộ tạm trú', 12)}
                            <div className="form-group full-width">
                                <label className="form-label" htmlFor="requestContent">
                                    Nội dung đề nghị <span className="required">*</span>
                                </label>
                                <textarea
                                    id="requestContent"
                                    className="form-textarea"
                                    placeholder="Đăng ký tạm trú tại [Xã/Phường] - [Tỉnh/Thành phố]"
                                    value={form.requestContent}
                                    onChange={(event) => updateField('requestContent', event.target.value)}
                                />
                            </div>
                            {renderInput('temporaryUntilDate', 'date', '', undefined, false, 'temporaryUntilDate')}
                        </div>
                        <p className="dktt-inline-note warning">
                            Lưu ý: Thời hạn tạm trú không vượt quá thời hạn tạm trú của chủ hộ tạm trú, không vượt quá
                            thời gian trong hợp đồng thuê nhà và chỉ được tối đa 2 năm.
                        </p>
                    </Section>

                    <Section
                        number={5}
                        title="NHỮNG THÀNH VIÊN TRONG HỘ GIA ĐÌNH CÙNG THAY ĐỔI"
                        action={renderCccdHeaderAction('member', 'Đọc CCCD và thêm thành viên')}
                    >
                        <div className="dktt-table-caption">
                            <div className="dktt-sub-title" style={{ margin: 0, borderBottom: 'none' }}>
                                Những thành viên trong hộ gia đình cùng thay đổi
                            </div>
                            <span className="dktt-badge dktt-badge-soft">Tùy chọn</span>
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
                                        <button type="button" onClick={() => setCccdQueue([])} aria-label="Đóng hàng đợi">
                                            ×
                                        </button>
                                    )}
                                </div>
                                <div className="cccd-upload-queue-list">
                                    {cccdQueue.map((item, index) => (
                                        <div key={item.id} className={`cccd-upload-queue-item ${item.status}`}>
                                            <span className="cccd-upload-queue-icon">
                                                {item.status === 'processing' && (
                                                    <LoaderCircle size={16} className="cccd-queue-spinner" />
                                                )}
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
                            <table className="dktt-member-table tamtru-member-table">
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
                                    {form.householdMembers.map((member, index) => (
                                        <tr key={member.id}>
                                            <td className="col-action">
                                                {index === 0 ? (
                                                    <button
                                                        type="button"
                                                        className="dktt-btn-add"
                                                        onClick={addMember}
                                                        title="Thêm thành viên"
                                                    >
                                                        +
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="dktt-btn-remove"
                                                        onClick={() => removeMember(member.id)}
                                                        title="Xóa dòng"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </td>
                                            <td className="col-stt">{index + 1}</td>
                                            <td>
                                                <input
                                                    className="dktt-table-input"
                                                    value={member.fullName}
                                                    placeholder="Họ và tên"
                                                    onChange={(event) =>
                                                        updateMember(member.id, { fullName: event.target.value })
                                                    }
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    className="dktt-table-input"
                                                    type="date"
                                                    value={member.dateOfBirth}
                                                    onChange={(event) =>
                                                        updateMember(member.id, { dateOfBirth: event.target.value })
                                                    }
                                                />
                                            </td>
                                            <td>
                                                <select
                                                    className="dktt-table-select"
                                                    value={member.gender}
                                                    onChange={(event) =>
                                                        updateMember(member.id, { gender: event.target.value })
                                                    }
                                                >
                                                    <option value="">-- Chọn --</option>
                                                    {genderOptions.map((item) => (
                                                        <option key={item} value={item}>
                                                            {item}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td>
                                                <input
                                                    className="dktt-table-input"
                                                    maxLength={12}
                                                    value={member.citizenId}
                                                    placeholder="12 chữ số"
                                                    onChange={(event) =>
                                                        updateMember(member.id, { citizenId: event.target.value })
                                                    }
                                                />
                                            </td>
                                            <td>
                                                <select
                                                    className="dktt-table-select"
                                                    value={member.relationshipWithHead}
                                                    onChange={(event) =>
                                                        updateMember(member.id, {
                                                            relationshipWithHead: event.target.value,
                                                        })
                                                    }
                                                >
                                                    <option value="">-- Chọn --</option>
                                                    {relationshipOptions.map((item) => (
                                                        <option key={item} value={item}>
                                                            {item}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="dktt-note tamtru-table-note">
                            Bảng này chỉ cần khai khi có thêm nhân khẩu cùng thay đổi tạm trú. Nếu đã nhập một dòng thì
                            cần điền đủ toàn bộ cột bắt buộc của dòng đó.
                        </p>
                    </Section>

                    <Section number={6} title="HỒ SƠ ĐÍNH KÈM">
                        <div className="dktt-upload-summary">
                            <p className="dktt-note" style={{ marginBottom: 8 }}>
                                Vui lòng đính kèm các tệp hình ảnh về các loại giấy tờ sau để giúp cơ quan chức năng xác
                                minh và giải quyết nhanh hồ sơ của ông/bà.
                            </p>
                            <p className="dktt-upload-meta">
                                Mỗi thời điểm áp dụng một trường hợp hồ sơ. Các giấy tờ bắt buộc luôn được giữ ở trạng
                                thái chọn; các giấy tờ có thể khai thác CSDL chuyên ngành thì không bắt buộc tải file
                                lên.
                            </p>
                        </div>
                        <div className="dktt-upload-case-list">
                            {dossierCases.map((dossierCase) => {
                                const isOpen = activeDossierCaseId === dossierCase.id;
                                return (
                                    <div key={dossierCase.id} className={`dktt-upload-case${isOpen ? ' open' : ''}`}>
                                        <button
                                            type="button"
                                            className="dktt-upload-case-header"
                                            onClick={() => setActiveDossierCaseId(dossierCase.id)}
                                        >
                                            <div className="dktt-upload-case-title">
                                                <span className="dktt-upload-case-bullet">-</span>
                                                <span>{dossierCase.title}</span>
                                            </div>
                                            <div className="tamtru-upload-case-controls">
                                                <input
                                                    type="radio"
                                                    checked={form.selectedDossierCaseId === dossierCase.id}
                                                    onClick={(event) => event.stopPropagation()}
                                                    onChange={() => selectDossierCase(dossierCase.id)}
                                                />
                                                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </div>
                                        </button>
                                        {isOpen && (
                                            <div className="dktt-upload-case-body">
                                                <div className="dktt-member-table-wrapper dktt-doc-table-wrapper">
                                                    <table className="dktt-member-table dktt-doc-table tamtru-doc-table">
                                                        <thead>
                                                            <tr>
                                                                <th className="dktt-doc-col-stt">STT</th>
                                                                <th className="dktt-doc-col-pick" />
                                                                <th className="dktt-doc-col-name">Tên giấy tờ</th>
                                                                <th className="dktt-doc-col-kind">Loại giấy tờ</th>
                                                                <th className="dktt-doc-col-template">Tải file mẫu</th>
                                                                <th className="dktt-doc-col-specialized">
                                                                    Khai thác CSDL chuyên ngành/ Biểu mẫu điện tử
                                                                </th>
                                                                <th className="dktt-doc-col-attach">Đính kèm</th>
                                                                <th className="dktt-doc-col-quantity">Số lượng</th>
                                                                <th className="dktt-doc-col-note">Ghi chú</th>
                                                                <th className="dktt-doc-col-action">Thao tác</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {dossierCase.documents.map((document, index) => {
                                                                const draft = form.attachmentDrafts[document.id];
                                                                return (
                                                                    <tr key={document.id}>
                                                                        <td className="dktt-doc-cell-center dktt-doc-cell-stt">
                                                                            {index + 1}
                                                                        </td>
                                                                        <td className="dktt-doc-cell-center dktt-doc-cell-pick">
                                                                            <input
                                                                                className="dktt-doc-checkbox"
                                                                                type="checkbox"
                                                                                checked={draft?.checked || false}
                                                                                onChange={(event) =>
                                                                                    updateAttachment(document.id, {
                                                                                        checked: event.target.checked,
                                                                                    })
                                                                                }
                                                                                disabled={document.required}
                                                                            />
                                                                        </td>
                                                                        <td>
                                                                            <div className="dktt-doc-name">
                                                                                <strong>
                                                                                    {document.name}
                                                                                    {document.required && (
                                                                                        <span className="req"> *</span>
                                                                                    )}
                                                                                </strong>
                                                                            </div>
                                                                        </td>
                                                                        <td>
                                                                            <select
                                                                                className="dktt-table-select dktt-doc-select"
                                                                                value={document.kind}
                                                                                disabled
                                                                            >
                                                                                <option value={document.kind}>
                                                                                    {document.kind}
                                                                                </option>
                                                                            </select>
                                                                        </td>
                                                                        <td className="dktt-doc-cell-center">
                                                                            {document.templateAvailable ? (
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
                                                                            ) : (
                                                                                <span className="dktt-table-placeholder">
                                                                                    -
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td>
                                                                            <span className="dktt-table-placeholder">
                                                                                Không áp dụng
                                                                            </span>
                                                                        </td>
                                                                        <td>
                                                                            <label className="dktt-doc-attach">
                                                                                <input
                                                                                    type="file"
                                                                                    accept="image/png,image/jpeg,image/heic,image/heif,.heic,.heif,application/pdf"
                                                                                    onChange={(event) =>
                                                                                        updateAttachmentFile(
                                                                                            document.id,
                                                                                            event.target.files?.[0],
                                                                                            draft?.quantity || document.quantity,
                                                                                        )
                                                                                    }
                                                                                />
                                                                                <Paperclip size={14} />
                                                                                <span className="attachment-review-inline">
                                                                                    <span>{draft?.fileName || 'Chọn file'}</span>
                                                                                    <AttachmentReviewBadge review={draft?.documentReview} />
                                                                                </span>
                                                                            </label>
                                                                        </td>
                                                                        <td>
                                                                            <input
                                                                                className="dktt-table-input dktt-doc-qty-input"
                                                                                value={
                                                                                    draft?.quantity || document.quantity
                                                                                }
                                                                                onChange={(event) =>
                                                                                    updateAttachment(document.id, {
                                                                                        quantity: event.target.value,
                                                                                    })
                                                                                }
                                                                            />
                                                                        </td>
                                                                        <td>
                                                                            <input
                                                                                className="dktt-table-input dktt-doc-note-input"
                                                                                value={draft?.note || ''}
                                                                                placeholder="Ghi chú"
                                                                                onChange={(event) =>
                                                                                    updateAttachment(document.id, {
                                                                                        note: event.target.value,
                                                                                    })
                                                                                }
                                                                            />
                                                                        </td>
                                                                        <td className="dktt-doc-cell-center">
                                                                            <label
                                                                                className="dktt-doc-icon-btn"
                                                                                title="Thêm tệp đính kèm"
                                                                            >
                                                                                <input
                                                                                    type="file"
                                                                                    accept="image/png,image/jpeg,image/heic,image/heif,.heic,.heif,application/pdf"
                                                                                    onChange={(event) =>
                                                                                        updateAttachmentFile(
                                                                                            document.id,
                                                                                            event.target.files?.[0],
                                                                                            draft?.quantity || document.quantity,
                                                                                        )
                                                                                    }
                                                                                />
                                                                                <Plus size={14} />
                                                                                <AttachmentReviewBadge review={draft?.documentReview} />
                                                                            </label>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {renderHelpText('dossier')}
                    </Section>

                    <Section number={7} title="THÔNG TIN NHẬN THÔNG BÁO TÌNH TRẠNG HỒ SƠ, KẾT QUẢ GIẢI QUYẾT HỒ SƠ">
                        <div className="dktt-form-row cols-2">
                            <div className="form-group">
                                <label className="form-label" htmlFor="notificationMethod">
                                    Hình thức nhận thông báo
                                </label>
                                <select
                                    id="notificationMethod"
                                    className="form-select"
                                    value={form.notificationMethod}
                                    onChange={(event) => updateField('notificationMethod', event.target.value)}
                                >
                                    {notificationMethods.map((item) => (
                                        <option key={item.value} value={item.value}>
                                            {item.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {renderSelect('resultMethod', resultMethods)}
                        </div>
                    </Section>

                    <Section number={8} title="THÔNG TIN LỆ PHÍ">
                        <div className="tamtru-radio-line">
                            <label>
                                <input
                                    type="radio"
                                    name="feeType"
                                    checked={form.feeType === 'co-phi'}
                                    onChange={() => handleFeeTypeChange('co-phi')}
                                />{' '}
                                Có phí
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="feeType"
                                    checked={form.feeType === 'mien-phi'}
                                    onChange={() => handleFeeTypeChange('mien-phi')}
                                />{' '}
                                Miễn phí
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="feeType"
                                    checked={form.feeType === 'khong-nop'}
                                    onChange={() => handleFeeTypeChange('khong-nop')}
                                />{' '}
                                Không phải nộp lệ phí
                            </label>
                            {helpButton('fee', activeHelp, setActiveHelp)}
                        </div>
                        <div className="dktt-form-row cols-2">
                            {renderInput('feeAmount', 'text', '', undefined, true)}
                            {renderInput(
                                'feeExemptionReason',
                                'text',
                                'Nhập lý do miễn lệ phí',
                                undefined,
                                form.feeType === 'co-phi',
                            )}
                            <div className="form-group full-width">
                                <label className="form-label" htmlFor="feeDescription">
                                    Mô tả
                                </label>
                                <textarea
                                    id="feeDescription"
                                    className="form-textarea"
                                    value={form.feeDescription}
                                    onChange={(event) => updateField('feeDescription', event.target.value)}
                                />
                            </div>
                        </div>
                        {renderHelpText('fee')}
                    </Section>

                    <label className="dktt-legal-check">
                        <input
                            type="checkbox"
                            checked={form.committed}
                            onChange={(event) => updateField('committed', event.target.checked)}
                        />
                        <span>Tôi xin chịu trách nhiệm trước pháp luật về lời khai trên</span>
                    </label>

                    <div className="dktt-actions">
                        <button
                            className="btn btn-primary"
                            type="button"
                            onClick={() => showToast('Tính năng in CT01 đang ở chế độ demo.')}
                        >
                            <FileText size={16} /> In CT01
                        </button>
                        <button className="btn btn-outline" type="button" onClick={() => navigate('/')}>
                            <ArrowLeft size={16} /> Quay lại
                        </button>
                        <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={() => showToast('Đã lưu nháp hồ sơ demo.')}
                        >
                            <Save size={16} /> Lưu nháp
                        </button>
                        <button className="btn btn-primary" type="button" onClick={handleSubmit} disabled={isSubmittingApplication}>
                            <Send size={16} /> {isSubmittingApplication ? 'Đang gửi...' : 'Nộp hồ sơ'}
                        </button>
                    </div>

                    {review && (
                        <div className={`tamtru-review ${review.status.toLowerCase()}`}>
                            <div className="tamtru-review-head">
                                <Bot size={20} />
                                <div>
                                    <strong>AI rà soát hồ sơ</strong>
                                    <span>Rủi ro: {review.riskScore}/100</span>
                                </div>
                            </div>
                            <h2>
                                {review.status === 'VALID'
                                    ? 'Hồ sơ đủ điều kiện tiền kiểm'
                                    : review.status === 'NEED_REVIEW'
                                      ? 'Hồ sơ cần kiểm tra thêm'
                                      : 'Hồ sơ thiếu/sai thông tin'}
                            </h2>
                            {[...review.errors, ...review.warnings].map((item) => (
                                <div className="tamtru-review-item" key={`${item.title}-${item.reason}`}>
                                    <strong>{item.title}</strong>
                                    <p>{item.reason}</p>
                                    <span>{item.suggestion}</span>
                                </div>
                            ))}
                            {review.suggestions.map((item) => (
                                <p className="tamtru-suggestion" key={item}>
                                    {item}
                                </p>
                            ))}
                        </div>
                    )}
                </div>
                <aside className="service-sidebar dktt-service-sidebar" aria-label="Thông tin dịch vụ">
                    <div className="sidebar-info-card">
                        <div className="sidebar-info-card-header">
                            <div className="sidebar-info-card-title">Giấy tờ cần chuẩn bị</div>
                        </div>
                        <div className="sidebar-info-card-body">
                            <ul className="info-list">
                                {(service.requiredDocs || []).map((doc, index) => (
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
                                {(service.steps || []).map((step, index) => (
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
                                <div
                                    style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8375rem' }}
                                >
                                    <span style={{ color: 'var(--text-secondary)' }}>Thời gian xử lý</span>
                                    <strong style={{ color: '#C8441A' }}>{service.processingTime}</strong>
                                </div>
                                <div
                                    style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8375rem' }}
                                >
                                    <span style={{ color: 'var(--text-secondary)' }}>Lệ phí</span>
                                    <strong style={{ color: 'var(--accent)' }}>{service.fee}</strong>
                                </div>
                                <div
                                    style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8375rem' }}
                                >
                                    <span style={{ color: 'var(--text-secondary)' }}>Danh mục</span>
                                    <strong>{service.category}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>

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

            {pendingResidenceSuggestion && (
                <div className="cccd-consent-backdrop" role="presentation">
                    <section
                        className="cccd-consent-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="residence-suggestion-title"
                    >
                        <div className="cccd-consent-icon">
                            <Home size={24} />
                        </div>
                        <h2 id="residence-suggestion-title">{pendingResidenceSuggestion.title}</h2>
                        <p>{pendingResidenceSuggestion.description}</p>
                        <div className="cccd-suggestion-list">
                            {Object.entries(pendingResidenceSuggestion.fields).map(([fieldId, value]) => (
                                <div className="cccd-suggestion-item" key={fieldId}>
                                    <span>{pendingResidenceSuggestion.fieldLabels[fieldId] || fieldId}</span>
                                    <strong>{pendingResidenceSuggestion.displayValues?.[fieldId] || value}</strong>
                                </div>
                            ))}
                        </div>
                        <div className="cccd-consent-actions">
                            <button
                                type="button"
                                className="cccd-consent-decline"
                                onClick={() => setPendingResidenceSuggestion(null)}
                            >
                                Bỏ qua
                            </button>
                            <button type="button" className="cccd-consent-accept" onClick={acceptResidenceSuggestion}>
                                Áp dụng gợi ý
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {toast && (
                <div className="dktt-toast" role="alert">
                    {toast}
                </div>
            )}
            {showMissingRequiredModal && (
                <MissingRequiredFieldsModal onClose={() => setShowMissingRequiredModal(false)} />
            )}
        </div>
    );
};

export default DangKyTamTruPage;
