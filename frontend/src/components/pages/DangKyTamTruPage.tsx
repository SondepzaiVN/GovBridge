import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, ChevronRight, FileText, HelpCircle, Home, Plus, Save, Send, Trash2 } from 'lucide-react';
import { administrativeUnitService } from '../../api/administrativeUnitService';
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
import type { FormFieldOption } from '../../types';
import {
    validateTamTruApplication,
    type TamTruApplicationData,
    type TamTruAttachmentDraft,
    type TamTruHouseholdMember,
    type TamTruReviewResult,
} from '../../utils/validateTamTruApplication';

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
                checked: false,
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
    procedureTypeCode: '',
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
    receiveOrgAddress: 'Cơ quan thực hiện',
    receiveOrgPhone: 'Số điện thoại',
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

const Section: React.FC<{ number: number; title: string; children: React.ReactNode }> = ({ number, title, children }) => (
    <section className="dktt-section open">
        <div className="dktt-section-header">
            <div className="dktt-section-header-left">
                <span className="dktt-section-number">{number}</span>
                <h3 className="dktt-section-title">{title}</h3>
            </div>
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

const findOptionByName = (options: FormFieldOption[], includes: string[]) => (
    options.find((option) => includes.every((item) => option.label.toLowerCase().includes(item.toLowerCase()))) || null
);

const agencyNameFromWard = (wardLabel: string) => (wardLabel ? `Công an ${wardLabel}` : '');

const DangKyTamTruPage: React.FC = () => {
    const navigate = useNavigate();
    const [form, setForm] = useState<TamTruApplicationData>(initialForm);
    const [provinceOptions, setProvinceOptions] = useState<FormFieldOption[]>([]);
    const [receiveWardOptions, setReceiveWardOptions] = useState<FormFieldOption[]>([]);
    const [temporaryWardOptions, setTemporaryWardOptions] = useState<FormFieldOption[]>([]);
    const [administrativeError, setAdministrativeError] = useState('');
    const [review, setReview] = useState<TamTruReviewResult | null>(null);
    const [toast, setToast] = useState('');
    const [activeDossierCaseId, setActiveDossierCaseId] = useState(dossierCases[0]?.id || '');
    const [memberCounter, setMemberCounter] = useState(2);
    const [activeHelp, setActiveHelp] = useState('');

    const procedureCases = procedureCasesByType[form.procedureTypeCode] || [];
    const showRegistrationMode = form.procedureTypeCode === 'dang-ky-tam-tru';
    const updateField = <K extends keyof TamTruApplicationData>(field: K, value: TamTruApplicationData[K]) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setReview(null);
    };

    const showToast = (message: string) => {
        setToast(message);
        window.setTimeout(() => setToast(''), 3200);
    };

    useEffect(() => {
        const controller = new AbortController();
        administrativeUnitService.getProvinces(controller.signal)
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
            setReceiveWardOptions([]);
            return;
        }

        const controller = new AbortController();
        administrativeUnitService.getWards(form.receiveCityCode, controller.signal)
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
            setTemporaryWardOptions([]);
            return;
        }

        const controller = new AbortController();
        administrativeUnitService.getWards(form.temporaryCityCode, controller.signal)
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
    const getTemporaryWardLabel = (code: string) => temporaryWardOptions.find((item) => item.value === code)?.label || '';

    const buildRequestContent = (wardCode: string, provinceCode: string) => {
        const wardLabel = getTemporaryWardLabel(wardCode);
        const provinceLabel = getProvinceLabel(provinceCode);
        return wardLabel && provinceLabel ? `Đăng ký tạm trú tại ${wardLabel} - ${provinceLabel}` : '';
    };

    const handleReceiveProvinceChange = (code: string) => {
        setForm((prev) => ({
            ...prev,
            receiveCityCode: code,
            receiveVillageCode: '',
            receiveOrgAddress: '',
            receiveOrgPhone: '',
        }));
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
        setReview(null);
    };

    const handleTemporaryWardChange = (code: string) => {
        setForm((prev) => {
            const nextContent = buildRequestContent(code, prev.temporaryCityCode);
            return {
                ...prev,
                temporaryVillageCode: code,
                requestContent: !prev.requestContent || prev.requestContent.startsWith('Đăng ký tạm trú tại') ? nextContent : prev.requestContent,
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

    const updateMember = (id: number, patch: Partial<TamTruHouseholdMember>) => {
        setForm((prev) => ({
            ...prev,
            householdMembers: prev.householdMembers.map((member) => member.id === id ? { ...member, ...patch } : member),
        }));
        setReview(null);
    };

    const addMember = () => {
        setForm((prev) => ({ ...prev, householdMembers: [...prev.householdMembers, createBlankMember(memberCounter)] }));
        setMemberCounter((prev) => prev + 1);
    };

    const removeMember = (id: number) => {
        setForm((prev) => ({
            ...prev,
            householdMembers: prev.householdMembers.length <= 1
                ? prev.householdMembers
                : prev.householdMembers.filter((member) => member.id !== id),
        }));
    };

    const runReview = () => {
        const result = validateTamTruApplication(form);
        setReview(result);
        return result;
    };

    const handleSubmit = () => {
        const result = runReview();
        if (result.status === 'INVALID') {
            showToast('Hồ sơ còn lỗi bắt buộc. Vui lòng xem phần AI rà soát.');
            return;
        }
        showToast('Đã nộp hồ sơ demo. GovBridge sẽ chuyển hồ sơ sang bước xử lý mô phỏng.');
    };

    const handleAutofill = async () => {
        let canTho = findOptionByName(provinceOptions, ['Cần Thơ']);
        if (!canTho && provinceOptions.length > 0) canTho = provinceOptions[0];

        let receiveWard = receiveWardOptions.find((item) => /Tân An|Ninh Kiều/i.test(item.label)) || receiveWardOptions[0] || null;
        let temporaryWard = temporaryWardOptions.find((item) => /Tân An|Ninh Kiều/i.test(item.label)) || temporaryWardOptions[0] || null;

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
            requestContent: temporaryWard && canTho ? `Đăng ký tạm trú tại ${temporaryWard.label} - ${canTho.label}` : 'Đăng ký tạm trú tại Phường Tân An - Thành phố Cần Thơ',
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

    const renderHelpText = (fieldId: string) => (
        activeHelp === fieldId && <span className="tamtru-help-text">{fieldHelp[fieldId]}</span>
    );

    const renderInput = (
        field: keyof TamTruApplicationData,
        type = 'text',
        placeholder = '',
        maxLength?: number,
        readOnly = false,
        helpId?: string,
    ) => (
        <div className="form-group">
            <label className="form-label" htmlFor={field}>
                {fieldLabels[field]}{requiredFields.has(field) && <span className="required"> *</span>}
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
        </div>
    );

    const renderSelect = (
        field: keyof TamTruApplicationData,
        options: Array<{ value: string; label: string }> | string[],
        placeholder = '-- Chọn --',
        helpId?: string,
        onChange?: (value: string) => void,
    ) => (
        <div className="form-group">
            <label className="form-label" htmlFor={field}>
                {fieldLabels[field]}{requiredFields.has(field) && <span className="required"> *</span>}
                {helpId && helpButton(helpId, activeHelp, setActiveHelp)}
            </label>
            <select
                id={field}
                className="form-select"
                value={String(form[field])}
                onChange={(event) => onChange ? onChange(event.target.value) : updateField(field, event.target.value as never)}
            >
                <option value="">{placeholder}</option>
                {options.map((item) => {
                    const value = typeof item === 'string' ? item : item.value;
                    const label = typeof item === 'string' ? item : item.label;
                    return <option key={value} value={value}>{label}</option>;
                })}
            </select>
            {helpId && renderHelpText(helpId)}
        </div>
    );

    return (
        <div className="main-content dktt-main-content tamtru-page animate-slide-up">
            <nav className="breadcrumb" aria-label="Breadcrumb">
                <Link to="/"><Home size={13} /> Trang chủ</Link>
                <ChevronRight size={13} className="breadcrumb-sep" />
                <span>Hồ sơ Đăng ký tạm trú</span>
            </nav>

            <div className="dktt-page-header">
                <h1>HỒ SƠ ĐĂNG KÝ TẠM TRÚ</h1>
                <p>GovBridge mô phỏng quy trình tạm trú phục vụ demo, không thay thế hệ thống chính thức.</p>
            </div>

            <div className="dktt-ai-hint">
                <span className="dktt-ai-hint-icon"><img src="/logo_Gov_Bridge.jpg" alt="AI" /></span>
                <span><strong>Mẹo:</strong> Nhấn vào nút Trợ lý AI để tự động điền form bằng giọng nói hoặc ảnh CCCD.</span>
            </div>

            <div className="dktt-required-note">
                <strong>Ghi chú:</strong> Các thông tin có dấu <span className="red">(*)</span> là thông tin bắt buộc phải nhập
            </div>

            <div className="tamtru-toolbar">
                <button type="button" className="btn btn-secondary" onClick={handleAutofill}>
                    <Bot size={16} />
                    AI điền thử hồ sơ
                </button>
                <button type="button" className="btn btn-outline" onClick={runReview}>
                    <FileText size={16} />
                    AI rà soát
                </button>
            </div>

            <div className="tamtru-shell">
                <div className="tamtru-form">
                    <Section number={1} title="CƠ QUAN THỰC HIỆN">
                        {administrativeError && <p className="form-error-msg" role="alert">{administrativeError}</p>}
                        <div className="dktt-form-row cols-2">
                            {renderSelect('receiveCityCode', provinceOptions, 'Chọn', undefined, handleReceiveProvinceChange)}
                            {renderSelect('receiveVillageCode', receiveWardOptions, 'Chọn', undefined, handleReceiveWardChange)}
                            {renderInput('receiveOrgAddress', 'text', 'Cơ quan thực hiện', undefined, true)}
                            {renderInput('receiveOrgPhone', 'text', 'Số điện thoại', undefined, true)}
                        </div>
                    </Section>

                    <Section number={2} title="THỦ TỤC HÀNH CHÍNH YÊU CẦU">
                        <div className="dktt-form-row cols-2">
                            {renderSelect('procedureTypeCode', procedureTypes, '-- Chọn --', 'procedureTypeCode', handleProcedureChange)}
                            {renderSelect('procedureCaseCode', procedureCases, '-- Chọn --', 'procedureCaseCode')}
                        </div>
                        {showRegistrationMode && (
                            <div className="tamtru-radio-line">
                                <label><input type="radio" name="registrationMode" checked={form.registrationMode === 'lap-ho-moi'} onChange={() => updateField('registrationMode', 'lap-ho-moi')} /> Đăng ký tạm trú lập hộ mới</label>
                                <label><input type="radio" name="registrationMode" checked={form.registrationMode === 'vao-ho-da-co'} onChange={() => updateField('registrationMode', 'vao-ho-da-co')} /> Đăng ký tạm trú vào hộ đã có</label>
                            </div>
                        )}
                    </Section>

                    <Section number={3} title="THÔNG TIN NGƯỜI ĐỀ NGHỊ ĐĂNG KÝ TẠM TRÚ">
                        <div className="tamtru-choice-notes">
                            <label>
                                <input type="radio" name="declareMode" checked={form.declareMode === 'self'} onChange={() => updateField('declareMode', 'self')} />
                                <span><strong>Người khai thông tin là người Đăng ký tạm trú</strong><small>Tự động điền các thông tin của chủ tài khoản được lấy từ dữ liệu dân cư.</small></span>
                            </label>
                            <label>
                                <input type="radio" name="declareMode" checked={form.declareMode === 'proxy'} onChange={() => updateField('declareMode', 'proxy')} />
                                <span><strong>Khai hộ</strong><small>Yêu cầu khai đúng các trường thông tin có trong cơ sở dữ liệu quốc gia về dân cư của người được khai hộ.</small></span>
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

                    <Section number={4} title="THÔNG TIN ĐỀ NGHỊ ĐĂNG KÝ TẠM TRÚ">
                        <div className="dktt-form-row cols-2">
                            {renderSelect('temporaryCityCode', provinceOptions, 'Chọn', undefined, handleTemporaryProvinceChange)}
                            {renderSelect('temporaryVillageCode', temporaryWardOptions, 'Chọn', undefined, handleTemporaryWardChange)}
                            <div className="form-group full-width">
                                <label className="form-label" htmlFor="temporaryAddress">{fieldLabels.temporaryAddress} <span className="required">*</span></label>
                                <textarea id="temporaryAddress" className="form-textarea" placeholder="Địa chỉ đăng ký tạm trú" value={form.temporaryAddress} onChange={(event) => updateField('temporaryAddress', event.target.value)} />
                            </div>
                            {renderInput('householderName', 'text', 'Họ tên chủ hộ tạm trú')}
                            {renderSelect('householderRelationship', relationshipOptions, '-- Chọn --', 'householderRelationship')}
                            {renderInput('householderCitizenId', 'text', 'Số định danh cá nhân chủ hộ tạm trú', 12)}
                            <div className="form-group full-width">
                                <label className="form-label" htmlFor="requestContent">Nội dung đề nghị <span className="required">*</span></label>
                                <textarea id="requestContent" className="form-textarea" placeholder="Đăng ký tạm trú tại [Xã/Phường] - [Tỉnh/Thành phố]" value={form.requestContent} onChange={(event) => updateField('requestContent', event.target.value)} />
                            </div>
                            {renderInput('temporaryUntilDate', 'date', '', undefined, false, 'temporaryUntilDate')}
                        </div>
                        <p className="dktt-inline-note warning">Lưu ý: Thời hạn tạm trú không vượt quá thời hạn tạm trú của chủ hộ tạm trú, không vượt quá thời gian trong hợp đồng thuê nhà và chỉ được tối đa 2 năm.</p>
                    </Section>

                    <Section number={5} title="NHỮNG THÀNH VIÊN TRONG HỘ GIA ĐÌNH CÙNG THAY ĐỔI">
                        <div className="dktt-member-table-wrapper">
                            <table className="dktt-member-table tamtru-member-table">
                                <thead>
                                    <tr>
                                        <th>STT</th>
                                        <th>Họ và tên <span className="req">*</span></th>
                                        <th>Định dạng ngày sinh</th>
                                        <th>Ngày sinh <span className="req">*</span></th>
                                        <th>Giới tính <span className="req">*</span></th>
                                        <th>Số ĐDCN <span className="req">*</span></th>
                                        <th>Quan hệ với chủ hộ <span className="req">*</span></th>
                                        <th>Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {form.householdMembers.map((member, index) => (
                                        <tr key={member.id}>
                                            <td>{index + 1}</td>
                                            <td><input className="dktt-table-input" value={member.fullName} onChange={(event) => updateMember(member.id, { fullName: event.target.value })} /></td>
                                            <td>
                                                <select className="dktt-table-select" value={member.dateFormat} onChange={(event) => updateMember(member.id, { dateFormat: event.target.value })}>
                                                    {dateFormatOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                                                </select>
                                            </td>
                                            <td><input className="dktt-table-input" type="date" value={member.dateOfBirth} onChange={(event) => updateMember(member.id, { dateOfBirth: event.target.value })} /></td>
                                            <td>
                                                <select className="dktt-table-select" value={member.gender} onChange={(event) => updateMember(member.id, { gender: event.target.value })}>
                                                    <option value="">Chọn</option>
                                                    {genderOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                                                </select>
                                            </td>
                                            <td><input className="dktt-table-input" maxLength={12} value={member.citizenId} onChange={(event) => updateMember(member.id, { citizenId: event.target.value })} /></td>
                                            <td>
                                                <select className="dktt-table-select" value={member.relationshipWithHead} onChange={(event) => updateMember(member.id, { relationshipWithHead: event.target.value })}>
                                                    <option value="">Chọn</option>
                                                    {relationshipOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                                                </select>
                                            </td>
                                            <td>
                                                {form.householdMembers.length > 1 ? (
                                                    <button type="button" className="dktt-btn-remove" onClick={() => removeMember(member.id)} title="Xóa dòng">
                                                        <Trash2 size={16} />
                                                    </button>
                                                ) : <span className="dktt-table-placeholder">-</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <button type="button" className="dktt-btn-add tamtru-add-doc" onClick={addMember}>
                            <Plus size={16} /> Thêm thành viên
                        </button>
                    </Section>

                    <Section number={6} title="HỒ SƠ ĐÍNH KÈM">
                        <p className="dktt-note">Vui lòng đính kèm các tệp hình ảnh về các loại giấy tờ sau để giúp cơ quan chức năng xác minh và giải quyết nhanh hồ sơ của ông/bà.</p>
                        <div className="dktt-upload-case-list">
                            {dossierCases.map((dossierCase) => {
                                const isOpen = activeDossierCaseId === dossierCase.id;
                                return (
                                    <div key={dossierCase.id} className={`dktt-upload-case${isOpen ? ' open' : ''}`}>
                                        <button type="button" className="dktt-upload-case-header" onClick={() => setActiveDossierCaseId(dossierCase.id)}>
                                            <span>{dossierCase.title}</span>
                                            <input type="radio" checked={form.selectedDossierCaseId === dossierCase.id} onChange={() => selectDossierCase(dossierCase.id)} />
                                        </button>
                                        {isOpen && (
                                            <div className="dktt-upload-case-body">
                                                <div className="dktt-member-table-wrapper dktt-doc-table-wrapper">
                                                    <table className="dktt-member-table dktt-doc-table tamtru-doc-table">
                                                        <thead>
                                                            <tr>
                                                                <th>STT</th>
                                                                <th>Chọn</th>
                                                                <th>Tên giấy tờ</th>
                                                                <th>Loại giấy tờ</th>
                                                                <th>Tải file mẫu</th>
                                                                <th>Khai thác CSDL chuyên ngành / Biểu mẫu điện tử</th>
                                                                <th>Đính kèm</th>
                                                                <th>Số lượng</th>
                                                                <th>Ghi chú</th>
                                                                <th>Thao tác</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {dossierCase.documents.map((document, index) => {
                                                                const draft = form.attachmentDrafts[document.id];
                                                                return (
                                                                    <tr key={document.id}>
                                                                        <td>{index + 1}</td>
                                                                        <td><input type="checkbox" checked={draft?.checked || false} onChange={(event) => updateAttachment(document.id, { checked: event.target.checked })} /></td>
                                                                        <td>{document.name}{document.required && <span className="required"> *</span>}</td>
                                                                        <td>{document.kind}</td>
                                                                        <td><button type="button" className="dktt-doc-icon-btn">Mẫu</button></td>
                                                                        <td><span className="dktt-doc-chip">Không áp dụng</span></td>
                                                                        <td>{draft?.fileName || 'Chưa chọn file'}</td>
                                                                        <td><input className="dktt-table-input" value={draft?.quantity || document.quantity} onChange={(event) => updateAttachment(document.id, { quantity: event.target.value })} /></td>
                                                                        <td><input className="dktt-table-input" value={draft?.note || ''} onChange={(event) => updateAttachment(document.id, { note: event.target.value })} /></td>
                                                                        <td><button type="button" className="dktt-doc-icon-btn" onClick={() => updateAttachment(document.id, { checked: true, fileName: `${document.id}-demo.pdf`, quantity: draft?.quantity || document.quantity })}>Chọn file</button></td>
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
                                <label className="form-label" htmlFor="notificationMethod">Hình thức nhận thông báo</label>
                                <select id="notificationMethod" className="form-select" value={form.notificationMethod} onChange={(event) => updateField('notificationMethod', event.target.value)}>
                                    {notificationMethods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                                </select>
                            </div>
                            {renderSelect('resultMethod', resultMethods)}
                        </div>
                    </Section>

                    <Section number={8} title="THÔNG TIN LỆ PHÍ">
                        <div className="tamtru-radio-line">
                            <label><input type="radio" name="feeType" checked={form.feeType === 'co-phi'} onChange={() => handleFeeTypeChange('co-phi')} /> Có phí</label>
                            <label><input type="radio" name="feeType" checked={form.feeType === 'mien-phi'} onChange={() => handleFeeTypeChange('mien-phi')} /> Miễn phí</label>
                            <label><input type="radio" name="feeType" checked={form.feeType === 'khong-nop'} onChange={() => handleFeeTypeChange('khong-nop')} /> Không phải nộp lệ phí</label>
                            {helpButton('fee', activeHelp, setActiveHelp)}
                        </div>
                        <div className="dktt-form-row cols-2">
                            {renderInput('feeAmount', 'text', '', undefined, true)}
                            {renderInput('feeExemptionReason', 'text', 'Nhập lý do miễn lệ phí', undefined, form.feeType === 'co-phi')}
                            <div className="form-group full-width">
                                <label className="form-label" htmlFor="feeDescription">Mô tả</label>
                                <textarea id="feeDescription" className="form-textarea" value={form.feeDescription} onChange={(event) => updateField('feeDescription', event.target.value)} />
                            </div>
                        </div>
                        {renderHelpText('fee')}
                    </Section>

                    <label className="dktt-legal-check">
                        <input type="checkbox" checked={form.committed} onChange={(event) => updateField('committed', event.target.checked)} />
                        <span>Tôi xin chịu trách nhiệm trước pháp luật về lời khai trên</span>
                    </label>

                    <div className="dktt-actions">
                        <button className="btn btn-primary" type="button" onClick={() => showToast('Tính năng in CT01 đang ở chế độ demo.')}>
                            <FileText size={16} /> In CT01
                        </button>
                        <button className="btn btn-outline" type="button" onClick={() => navigate('/')}>
                            <ArrowLeft size={16} /> Quay lại
                        </button>
                        <button className="btn btn-secondary" type="button" onClick={() => showToast('Đã lưu nháp hồ sơ demo.')}>
                            <Save size={16} /> Lưu nháp
                        </button>
                        <button className="btn btn-primary" type="button" onClick={handleSubmit}>
                            <Send size={16} /> Nộp hồ sơ
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
                            {review.suggestions.map((item) => <p className="tamtru-suggestion" key={item}>{item}</p>)}
                        </div>
                    )}
                </div>
            </div>

            {toast && <div className="dktt-toast" role="alert">{toast}</div>}
        </div>
    );
};

export default DangKyTamTruPage;
