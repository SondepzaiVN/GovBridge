import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, ChevronRight, ChevronDown, ChevronUp, Home, Send, Save, Info, FileDown, Paperclip, Plus, Database } from 'lucide-react';
import { SERVICE_MAP } from '../../data/services';
import { useForm } from '../../contexts/FormContext';
import { FormFieldInput } from './ServicePageLayout';
import type { CCCDInfo, DocumentReviewUiState, FormField } from '../../types';
import { administrativeUnitService } from '../../api/administrativeUnitService';
import { ocrService } from '../../api/aiServices';
import { saveApplicationToDashboard, type DashboardDocument } from '../../utils/dashboardSync';
import { saveAttachmentFile } from '../../utils/attachmentStorage';
import { reviewUploadedDocument } from '../../utils/attachmentDocumentReview';
import { AttachmentReviewBadge } from '../common/AttachmentReviewBadge';
import {
  buildOptions,
  compareDates,
  createBlankFamilyMember,
  createBlankOverseasFamilyMember,
  createBlankOverseasStayRow,
  createSyntheticField,
  GENDER_OPTIONS,
  getOverseasFamilyErrors,
  getOverseasStayErrors,
  getResidenceDocumentCases,
  getStandardMemberErrors,
  HOUSEHOLD_RELATIONSHIP_OPTIONS,
  isLikelyValidFullName,
  isValidCitizenId,
  isValidVietnamesePhone,
  NATIONALITY_OPTIONS,
  normalizeDigits,
  type ResidenceDocumentRequirement,
  validateAddressDetail,
  validateServiceField,
  type FamilyMember,
  type OverseasFamilyMember,
  type OverseasStayRow,
} from './dangKyThuongTruForm';

const FIXED_RESIDENCE_AGENCY_VALUE = 'ca_phuong';
const FIXED_RESIDENCE_AGENCY_PHONE = '0292 3894 939';
const OVERSEAS_TOGGLE_FIELD = 'ct02Enabled';
const DECLARE_MODE_FIELD = 'declareMode';
const HOUSEHOLDER_NAME_FIELD_ID = 'chuHoHoTen';
const HOUSEHOLDER_RELATION_FIELD_ID = 'chuHoQuanHe';
const HOUSEHOLDER_DOCUMENT_FIELD_ID = 'chuHoGiayTo';
const POSTAL_ADDRESS_FIELD_ID = 'dkttPostalAddress';
const POSTAL_PHONE_FIELD_ID = 'dkttPostalPhone';
const OVERSEAS_PHOTO_FIELD_ID = 'ct02Photo';
const COLLAPSED_UPLOAD_CASE = '__collapsed__';
const CT01_TEMPLATE_URL = 'https://cdn.thuvienphapluat.vn/uploads/mst/images/DoanTien/CT01-mau.docx';
const SPECIALIZED_DATA_TEMP_DISABLED = true;
type ThuongTruCccdTarget = 'applicant' | 'familyMember';

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

const isBlankFamilyMember = (member: FamilyMember) => (
  !member.fullName
  && !member.dateOfBirth
  && !member.gender
  && !member.citizenId
  && !member.relationshipWithHouseholder
);

const toResidenceAgencyLabel = (wardName: string) => (
  wardName
    ? `Công an ${wardName.charAt(0).toLocaleLowerCase('vi-VN')}${wardName.slice(1)}`
    : ''
);

const getOptionLabel = (
  options: Array<{ value: string; label: string }>,
  value: string,
): string => options.find((option) => option.value === value)?.label || '';

const generateRandomCitizenId = (): string => {
  const firstDigit = String(Math.floor(Math.random() * 9) + 1);
  const remainingDigits = Array.from({ length: 11 }, () => String(Math.floor(Math.random() * 10))).join('');
  return `${firstDigit}${remainingDigits}`;
};

const buildResidenceRequestContent = (
  detailAddress: string,
  wardLabel: string,
  provinceLabel: string,
): string => {
  const addressParts = [detailAddress.trim(), wardLabel, provinceLabel].filter(Boolean);
  return addressParts.length > 0 ? `Đăng ký thường trú tại ${addressParts.join(', ')}` : '';
};

interface UploadRequirementDraft {
  checked: boolean;
  kind: string;
  quantity: string;
  note: string;
  fileNames: string[];
  files: File[];
  useSpecializedData: boolean;
  reviewByFileName?: Record<string, DocumentReviewUiState>;
}

const getUploadDraftKey = (caseId: string, requirementId: string) => `${caseId}:${requirementId}`;

const createUploadDraft = (requirement: ResidenceDocumentRequirement): UploadRequirementDraft => ({
  checked: requirement.required,
  kind: requirement.defaultKind || requirement.kindOptions?.[0] || 'Bản gốc',
  quantity: requirement.required ? '1' : '',
  note: '',
  fileNames: [],
  files: [],
  useSpecializedData: false,
  reviewByFileName: {},
});

interface SectionDef {
  id: string;
  number: number;
  title: string;
  fieldIds: string[];
  customContent?: 'procedure' | 'applicant' | 'request' | 'upload' | 'notification' | 'vneid';
}

const SECTIONS: SectionDef[] = [
  {
    id: 'co-quan',
    number: 1,
    title: 'Cơ quan thực hiện',
    fieldIds: ['tinhThanhCQ', 'xaPhuongCQ', 'coQuanDKCT', 'sdtCoQuan'],
  },
  {
    id: 'thu-tuc',
    number: 2,
    title: 'Thủ tục hành chính yêu cầu',
    fieldIds: ['thuTuc', 'truongHop', 'loaiDKTT'],
    customContent: 'procedure',
  },
  {
    id: 'nguoi-de-nghi',
    number: 3,
    title: 'Thông tin người đề nghị đăng ký thường trú',
    fieldIds: ['hoTen', 'ngaySinh', 'gioiTinh', 'danToc', 'tonGiao', 'cccd', 'sdt', 'email'],
    customContent: 'applicant',
  },
  {
    id: 'thong-tin-de-nghi',
    number: 4,
    title: 'Thông tin đề nghị',
    fieldIds: ['tinhThanhDN', 'xaPhuongDN', 'diaChiDN', 'noiDungDN'],
    customContent: 'request',
  },
  {
    id: 'ho-so-dinh-kem',
    number: 5,
    title: 'Trường hợp và hồ sơ đính kèm',
    fieldIds: [],
    customContent: 'upload',
  },
  {
    id: 'nhan-thong-bao',
    number: 6,
    title: 'Thông tin nhận thông báo tình trạng hồ sơ, kết quả giải quyết hồ sơ',
    fieldIds: ['hinhThucNhanTB', 'sdtNhanTB', 'emailNhanTB', 'hinhThucNhanKQ'],
    customContent: 'notification',
  },
  {
    id: 'vneid',
    number: 7,
    title: 'Thông tin xác nhận tờ khai thông tin cư trú bản điện tử',
    fieldIds: [],
    customContent: 'vneid',
  },
];

const OVERSEAS_SCALAR_FIELD_IDS = [
  'ct02HoTenNuocNgoai',
  'ct02QuocTichKhac',
  'ct02SoGiayToNN',
  'ct02NgayCapGiayTo',
  'ct02NoiCapGiayTo',
  'ct02NgayHetHan',
  'ct02NgheNghiepNuocNgoai',
  'ct02NoiLamViecNuocNgoai',
  'ct02NoiThuongTruNuocNgoai',
  'ct02DiaChiNuocNgoai',
  'ct02TinhThanhVN',
  'ct02XaPhuongVN',
  'ct02DiaChiVN',
];

const createTextField = (
  id: string,
  label: string,
  required = false,
  placeholder = '',
): FormField => createSyntheticField({
  id,
  label,
  type: 'text',
  required,
  placeholder,
});

const createDateField = (id: string, label: string, required = false): FormField =>
  createSyntheticField({
    id,
    label,
    type: 'date',
    required,
  });

const createPhoneField = (
  id: string,
  label: string,
  required = false,
  placeholder = '',
): FormField => createSyntheticField({
  id,
  label,
  type: 'phone',
  required,
  placeholder,
});

const createSelectField = (
  id: string,
  label: string,
  options: Array<{ value: string; label: string }>,
  required = false,
): FormField => createSyntheticField({
  id,
  label,
  type: 'select',
  required,
  options,
});

const createTextareaField = (
  id: string,
  label: string,
  required = false,
  placeholder = '',
): FormField => createSyntheticField({
  id,
  label,
  type: 'textarea',
  required,
  placeholder,
});

const DangKyThuongTruPage: React.FC = () => {
  const service = SERVICE_MAP['ho-khau'];
  const {
    formState,
    setFieldValue,
    setFieldError,
    touchField,
    fillFields,
  } = useForm();
  const navigate = useNavigate();

  const [provinceOptions, setProvinceOptions] = useState<FormField['options']>([]);
  const [agencyWardOptions, setAgencyWardOptions] = useState<FormField['options']>([]);
  const [requestWardOptions, setRequestWardOptions] = useState<FormField['options']>([]);
  const [ct02WardOptions, setCt02WardOptions] = useState<FormField['options']>([]);
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(true);
  const [isLoadingAgencyWards, setIsLoadingAgencyWards] = useState(Boolean(formState.values.tinhThanhCQ));
  const [isLoadingRequestWards, setIsLoadingRequestWards] = useState(Boolean(formState.values.tinhThanhDN));
  const [isLoadingCt02Wards, setIsLoadingCt02Wards] = useState(Boolean(formState.values.ct02TinhThanhVN));
  const [administrativeError, setAdministrativeError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [agreedLegal, setAgreedLegal] = useState(false);

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([createBlankFamilyMember(1)]);
  const [familyCounter, setFamilyCounter] = useState(2);
  const [overseasStayRows, setOverseasStayRows] = useState<OverseasStayRow[]>([createBlankOverseasStayRow(1)]);
  const [overseasStayCounter, setOverseasStayCounter] = useState(2);
  const [overseasFamilyMembers, setOverseasFamilyMembers] = useState<OverseasFamilyMember[]>([createBlankOverseasFamilyMember(1)]);
  const [overseasFamilyCounter, setOverseasFamilyCounter] = useState(2);
  const [ct02PhotoName, setCt02PhotoName] = useState('');
  const [uploadDrafts, setUploadDrafts] = useState<Record<string, UploadRequirementDraft>>({});
  const [uploadOpenCaseOverride, setUploadOpenCaseOverride] = useState<string | null>(null);
  const [uploadValidationMessage, setUploadValidationMessage] = useState('');

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const nextState: Record<string, boolean> = {};
    SECTIONS.forEach((section) => {
      nextState[section.id] = section.number <= 4;
    });
    return nextState;
  });

  const previousCaseRef = useRef('');
  const previousRegistrationModeRef = useRef(formState.values.loaiDKTT || '');
  const previousOverseasToggleRef = useRef(formState.values[OVERSEAS_TOGGLE_FIELD] === 'true');
  const autoHouseholderDocumentRef = useRef('');
  const previousAutoRequestContentRef = useRef('');
  const cccdInputRef = useRef<HTMLInputElement>(null);
  const cccdTargetRef = useRef<ThuongTruCccdTarget>('applicant');
  const [isReadingCccd, setIsReadingCccd] = useState(false);

  const selectedAgencyProvince = formState.values.tinhThanhCQ || '';
  const selectedAgencyWard = formState.values.xaPhuongCQ || '';
  const selectedRequestProvince = formState.values.tinhThanhDN || '';
  const selectedRequestWard = formState.values.xaPhuongDN || '';
  const selectedCt02Province = formState.values.ct02TinhThanhVN || '';
  const selectedCt02Ward = formState.values.ct02XaPhuongVN || '';
  const registrationMode = formState.values.loaiDKTT || '';
  const procedureCase = formState.values.truongHop || '';
  const declareMode = (formState.values[DECLARE_MODE_FIELD] as 'self' | 'proxy' | undefined) || 'proxy';
  const isOverseasDossier = formState.values[OVERSEAS_TOGGLE_FIELD] === 'true';
  const notificationMethod = formState.values.hinhThucNhanTB || '';
  const resultMethod = formState.values.hinhThucNhanKQ || '';
  const isFirstRegistration = procedureCase === 'lan_dau';
  const isNewHousehold = registrationMode === 'lap_ho_moi';
  const isIdentityAutofilled = false; // Disabled auto-lock for demo to allow manual typing
  const uploadCases = useMemo(
    () => getResidenceDocumentCases({ isNewHousehold, isOverseasDossier }),
    [isNewHousehold, isOverseasDossier],
  );
  const preferredUploadCaseId = (
    isOverseasDossier
      ? uploadCases.find((item) => item.id === 'overseas-vietnamese')?.id
      : isNewHousehold
        ? uploadCases.find((item) => item.id === 'owned-house')?.id
        : uploadCases.find((item) => item.id === 'non-owned-consent')?.id
  ) || uploadCases[0]?.id || '';
  const resolvedUploadOpenCaseId = uploadOpenCaseOverride === COLLAPSED_UPLOAD_CASE
    ? ''
    : uploadOpenCaseOverride && uploadCases.some((item) => item.id === uploadOpenCaseOverride)
      ? uploadOpenCaseOverride
      : null;
  const openUploadCaseId = resolvedUploadOpenCaseId === null ? preferredUploadCaseId : resolvedUploadOpenCaseId;

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(''), 3200);
  };

  useEffect(() => {
    if (!formState.values.thuTuc) setFieldValue('thuTuc', 'dktt');
    if (!formState.values.loaiDKTT) setFieldValue('loaiDKTT', 'lap_ho_moi');
    if (!formState.values[DECLARE_MODE_FIELD]) setFieldValue(DECLARE_MODE_FIELD, 'proxy');
  }, [formState.values, setFieldValue]);

  useEffect(() => {
    const controller = new AbortController();

    administrativeUnitService.getProvinces(controller.signal)
      .then((options) => {
        setProvinceOptions(options);
        setAdministrativeError('');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setAdministrativeError('Không tải được danh sách tỉnh/thành phố. Vui lòng tải lại trang.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingProvinces(false);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedAgencyProvince) return;

    const controller = new AbortController();

    administrativeUnitService.getWards(selectedAgencyProvince, controller.signal)
      .then((options) => {
        setAgencyWardOptions(options);
        setAdministrativeError('');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setAgencyWardOptions([]);
        setAdministrativeError('Không tải được danh sách xã/phường của cơ quan thực hiện.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingAgencyWards(false);
      });

    return () => controller.abort();
  }, [selectedAgencyProvince]);

  useEffect(() => {
    if (!selectedRequestProvince) return;

    const controller = new AbortController();

    administrativeUnitService.getWards(selectedRequestProvince, controller.signal)
      .then((options) => {
        setRequestWardOptions(options);
        setAdministrativeError('');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setRequestWardOptions([]);
        setAdministrativeError('Không tải được danh sách xã/phường của nơi đề nghị đăng ký thường trú.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingRequestWards(false);
      });

    return () => controller.abort();
  }, [selectedRequestProvince]);

  useEffect(() => {
    if (!selectedCt02Province) return;

    const controller = new AbortController();

    administrativeUnitService.getWards(selectedCt02Province, controller.signal)
      .then((options) => {
        setCt02WardOptions(options);
        setAdministrativeError('');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setCt02WardOptions([]);
        setAdministrativeError('Không tải được danh sách xã/phường trong phần CT02.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingCt02Wards(false);
      });

    return () => controller.abort();
  }, [selectedCt02Province]);

  useEffect(() => {
    if (selectedAgencyProvince && selectedAgencyWard) {
      if (
        formState.values.coQuanDKCT !== FIXED_RESIDENCE_AGENCY_VALUE
        || formState.values.sdtCoQuan !== FIXED_RESIDENCE_AGENCY_PHONE
      ) {
        fillFields({
          coQuanDKCT: FIXED_RESIDENCE_AGENCY_VALUE,
          sdtCoQuan: FIXED_RESIDENCE_AGENCY_PHONE,
        });
      }
      setFieldError('coQuanDKCT', '');
      setFieldError('sdtCoQuan', '');
      return;
    }

    if (formState.values.coQuanDKCT) setFieldValue('coQuanDKCT', '');
    if (formState.values.sdtCoQuan) setFieldValue('sdtCoQuan', '');
    setFieldError('coQuanDKCT', '');
    setFieldError('sdtCoQuan', '');
  }, [
    fillFields,
    formState.values.coQuanDKCT,
    formState.values.sdtCoQuan,
    selectedAgencyProvince,
    selectedAgencyWard,
    setFieldError,
    setFieldValue,
  ]);

  useEffect(() => {
    if (isFirstRegistration && registrationMode !== 'vao_ho_co') {
      setFieldValue('loaiDKTT', 'vao_ho_co');
    }
  }, [isFirstRegistration, registrationMode, setFieldValue]);

  useEffect(() => {
    if (!isOverseasDossier) {
      if (previousOverseasToggleRef.current) {
        const restoredCase = previousCaseRef.current;
        if (restoredCase && procedureCase === 'nhan_khau') {
          setFieldValue('truongHop', restoredCase);
        }
        fillFields(Object.fromEntries(OVERSEAS_SCALAR_FIELD_IDS.map((id) => [id, ''])));
        setCt02PhotoName('');
        setOverseasStayRows([createBlankOverseasStayRow(1)]);
        setOverseasStayCounter(2);
        setOverseasFamilyMembers([createBlankOverseasFamilyMember(1)]);
        setOverseasFamilyCounter(2);
        OVERSEAS_SCALAR_FIELD_IDS.forEach((fieldId) => setFieldError(fieldId, ''));
        setFieldError(OVERSEAS_PHOTO_FIELD_ID, '');
      }
      previousOverseasToggleRef.current = false;
      return;
    }

    if (!previousOverseasToggleRef.current && procedureCase && procedureCase !== 'nhan_khau') {
      previousCaseRef.current = procedureCase;
    }

    if (procedureCase !== 'nhan_khau') {
      setFieldValue('truongHop', 'nhan_khau');
    }

    previousOverseasToggleRef.current = true;
  }, [fillFields, isOverseasDossier, procedureCase, setFieldError, setFieldValue]);

  useEffect(() => {
    if (!autoHouseholderDocumentRef.current) {
      autoHouseholderDocumentRef.current = generateRandomCitizenId();
    }

    fillFields({
      [HOUSEHOLDER_NAME_FIELD_ID]: formState.values.hoTen || '',
      [HOUSEHOLDER_RELATION_FIELD_ID]: 'Chủ hộ',
      [HOUSEHOLDER_DOCUMENT_FIELD_ID]: autoHouseholderDocumentRef.current,
    });

    previousRegistrationModeRef.current = registrationMode;
  }, [fillFields, formState.values.hoTen, isNewHousehold, registrationMode]);

  useEffect(() => {
    if (notificationMethod === 'sms') {
      if (!formState.values.sdtNhanTB && formState.values.sdt) {
        setFieldValue('sdtNhanTB', formState.values.sdt);
      }
      if (formState.values.emailNhanTB) setFieldValue('emailNhanTB', '');
      return;
    }

    if (notificationMethod === 'email') {
      if (!formState.values.emailNhanTB && formState.values.email) {
        setFieldValue('emailNhanTB', formState.values.email);
      }
      if (formState.values.sdtNhanTB) setFieldValue('sdtNhanTB', '');
      return;
    }

    if (formState.values.sdtNhanTB) setFieldValue('sdtNhanTB', '');
    if (formState.values.emailNhanTB) setFieldValue('emailNhanTB', '');
  }, [
    formState.values.email,
    formState.values.emailNhanTB,
    formState.values.sdt,
    formState.values.sdtNhanTB,
    notificationMethod,
    setFieldValue,
  ]);

  useEffect(() => {
    if (resultMethod === 'buu_dien') {
      if (!formState.values[POSTAL_PHONE_FIELD_ID] && formState.values.sdt) {
        setFieldValue(POSTAL_PHONE_FIELD_ID, formState.values.sdt);
      }
      return;
    }

    if (formState.values[POSTAL_ADDRESS_FIELD_ID]) setFieldValue(POSTAL_ADDRESS_FIELD_ID, '');
    if (formState.values[POSTAL_PHONE_FIELD_ID]) setFieldValue(POSTAL_PHONE_FIELD_ID, '');
  }, [
    formState.values,
    resultMethod,
    setFieldValue,
  ]);

  const selectedAgencyWardLabel = getOptionLabel(agencyWardOptions || [], selectedAgencyWard);
  const selectedRequestProvinceLabel = getOptionLabel(provinceOptions || [], selectedRequestProvince);
  const selectedRequestWardLabel = getOptionLabel(requestWardOptions || [], selectedRequestWard);
  const selectedCt02ProvinceLabel = getOptionLabel(provinceOptions || [], selectedCt02Province);
  const selectedCt02WardLabel = getOptionLabel(ct02WardOptions || [], selectedCt02Ward);

  useEffect(() => {
    const nextContent = buildResidenceRequestContent(
      formState.values.diaChiDN || '',
      selectedRequestWardLabel,
      selectedRequestProvinceLabel,
    );

    if (!formState.values.noiDungDN || formState.values.noiDungDN === previousAutoRequestContentRef.current) {
      previousAutoRequestContentRef.current = nextContent;
      if (formState.values.noiDungDN !== nextContent) {
        setFieldValue('noiDungDN', nextContent);
      }
    }
  }, [
    formState.values.diaChiDN,
    formState.values.noiDungDN,
    selectedRequestProvinceLabel,
    selectedRequestWardLabel,
    setFieldValue,
  ]);

  const fieldMap = useMemo(() => {
    const nextMap = new Map<string, FormField>();

    service.fields.forEach((field) => {
      if (field.id === 'tinhThanhCQ' || field.id === 'tinhThanhDN') {
        nextMap.set(field.id, { ...field, options: provinceOptions });
        return;
      }

      if (field.id === 'xaPhuongCQ') {
        nextMap.set(field.id, { ...field, options: agencyWardOptions });
        return;
      }

      if (field.id === 'xaPhuongDN') {
        nextMap.set(field.id, { ...field, options: requestWardOptions });
        return;
      }

      if (field.id === 'coQuanDKCT') {
        nextMap.set(field.id, {
          ...field,
          options: [{
            value: FIXED_RESIDENCE_AGENCY_VALUE,
            label: toResidenceAgencyLabel(selectedAgencyWardLabel),
          }],
        });
        return;
      }

      nextMap.set(field.id, field);
    });

    return nextMap;
  }, [agencyWardOptions, provinceOptions, requestWardOptions, selectedAgencyWardLabel, service.fields]);

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const openErrorSections = (sectionIds: string[]) => {
    if (sectionIds.length === 0) return;
    setOpenSections((prev) => ({
      ...prev,
      ...Object.fromEntries(sectionIds.map((sectionId) => [sectionId, true])),
    }));
  };

  const getFieldValue = (fieldId: string) => formState.values[fieldId] || '';

  const renderFields = (
    fields: FormField[],
    columnsClass = '',
    disabledIds: string[] = [],
  ) => {
    if (fields.length === 0) return null;

    return (
      <div className={`dktt-form-row ${columnsClass}`}>
        {fields.map((field) => (
          <FormFieldInput
            key={field.id}
            field={field}
            value={getFieldValue(field.id)}
            onChange={(value) => handleFieldChange(field.id, value)}
            isAutofilled={!!formState.touched[field.id] && !!formState.values[field.id]}
            disabled={disabledIds.includes(field.id) || isFieldDisabled(field.id)}
          />
        ))}
      </div>
    );
  };

  const renderServiceFields = (
    fieldIds: string[],
    columnsClass = '',
    disabledIds: string[] = [],
  ) => renderFields(
    fieldIds
      .map((fieldId) => fieldMap.get(fieldId))
      .filter(Boolean) as FormField[],
    columnsClass,
    disabledIds,
  );

  const isFieldDisabled = (fieldId: string) => {
    if (fieldId === 'thuTuc') return true;
    if (fieldId === 'tinhThanhCQ') return isLoadingProvinces;
    if (fieldId === 'xaPhuongCQ') return !selectedAgencyProvince || isLoadingAgencyWards;
    if (fieldId === 'coQuanDKCT' || fieldId === 'sdtCoQuan') return true;
    if (fieldId === 'tinhThanhDN') return isLoadingProvinces;
    if (fieldId === 'xaPhuongDN') return !selectedRequestProvince || isLoadingRequestWards;
    if (fieldId === 'noiDungDN') return true;
    if (fieldId === 'truongHop') return isOverseasDossier;
    if (fieldId === 'loaiDKTT') return isFirstRegistration;
    if (
      ['hoTen', 'ngaySinh', 'gioiTinh', 'danToc', 'tonGiao', 'cccd'].includes(fieldId)
      && declareMode === 'self'
      && isIdentityAutofilled
    ) {
      return true;
    }
    return false;
  };

  const handleFieldChange = (fieldId: string, value: string) => {
    if (fieldId === 'tinhThanhCQ') {
      setFieldValue('tinhThanhCQ', value);
      setFieldValue('xaPhuongCQ', '');
      setFieldValue('coQuanDKCT', '');
      setFieldValue('sdtCoQuan', '');
      setAgencyWardOptions([]);
      setIsLoadingAgencyWards(Boolean(value));
      return;
    }

    if (fieldId === 'tinhThanhDN') {
      setFieldValue('tinhThanhDN', value);
      setFieldValue('xaPhuongDN', '');
      setRequestWardOptions([]);
      setIsLoadingRequestWards(Boolean(value));
      return;
    }

    if (fieldId === 'ct02TinhThanhVN') {
      setFieldValue('ct02TinhThanhVN', value);
      setFieldValue('ct02XaPhuongVN', '');
      setCt02WardOptions([]);
      setIsLoadingCt02Wards(Boolean(value));
      return;
    }

    if (fieldId === 'cccd' || fieldId === HOUSEHOLDER_DOCUMENT_FIELD_ID) {
      setFieldValue(fieldId, normalizeDigits(value));
      return;
    }

    setFieldValue(fieldId, value);
  };

  const getUploadDraft = (
    caseId: string,
    requirement: ResidenceDocumentRequirement,
  ): UploadRequirementDraft => {
    const key = getUploadDraftKey(caseId, requirement.id);
    return uploadDrafts[key] || createUploadDraft(requirement);
  };

  const patchUploadDraft = (
    caseId: string,
    requirement: ResidenceDocumentRequirement,
    patch: Partial<UploadRequirementDraft>,
  ) => {
    const key = getUploadDraftKey(caseId, requirement.id);
    setUploadValidationMessage('');
    setUploadDrafts((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || createUploadDraft(requirement)),
        ...patch,
      },
    }));
  };

  const toggleUploadRequirement = (
    caseId: string,
    requirement: ResidenceDocumentRequirement,
    checked: boolean,
  ) => {
    patchUploadDraft(caseId, requirement, checked
      ? { checked: true, quantity: getUploadDraft(caseId, requirement).quantity || '1' }
      : {
        checked: false,
        quantity: '',
        note: '',
        fileNames: [],
        files: [],
        useSpecializedData: false,
        reviewByFileName: {},
      });
  };

  const toggleSpecializedData = (
    caseId: string,
    requirement: ResidenceDocumentRequirement,
    checked: boolean,
  ) => {
    patchUploadDraft(caseId, requirement, {
      checked: true,
      useSpecializedData: checked,
      fileNames: checked ? [] : getUploadDraft(caseId, requirement).fileNames,
      files: checked ? [] : getUploadDraft(caseId, requirement).files,
      reviewByFileName: checked ? {} : getUploadDraft(caseId, requirement).reviewByFileName,
      quantity: getUploadDraft(caseId, requirement).quantity || '1',
    });
  };

  const updateUploadFiles = (
    caseId: string,
    requirement: ResidenceDocumentRequirement,
    inputFiles: FileList | null,
    mode: 'replace' | 'append' = 'replace',
  ) => {
    const nextFiles = Array.from(inputFiles || []);
    const nextNames = nextFiles.map((file) => file.name);
    const currentDraft = getUploadDraft(caseId, requirement);
    const nextReviewByFileName = mode === 'append'
      ? { ...(currentDraft.reviewByFileName || {}) }
      : {};
    patchUploadDraft(caseId, requirement, {
      checked: true,
      useSpecializedData: false,
      fileNames: mode === 'append'
        ? [...currentDraft.fileNames, ...nextNames]
        : nextNames,
      files: mode === 'append'
        ? [...currentDraft.files, ...nextFiles]
        : nextFiles,
      reviewByFileName: nextReviewByFileName,
      quantity: currentDraft.quantity || '1',
    });
    nextFiles.forEach((file) => {
      void reviewUploadedDocument({
        file,
        label: requirement.name,
        currentRoute: '/dang-ky-thuong-tru',
        ...(requirement.id === 'ct01' || requirement.id === 'ct02' ? { documentType: 'ct01' as const } : {}),
        onStatusChange: (documentReview) => {
          setUploadDrafts((prev) => {
            const key = getUploadDraftKey(caseId, requirement.id);
            const draft = prev[key] || createUploadDraft(requirement);
            return {
              ...prev,
              [key]: {
                ...draft,
                reviewByFileName: {
                  ...(draft.reviewByFileName || {}),
                  [file.name]: documentReview,
                },
              },
            };
          });
        },
      });
    });
  };

  const toggleUploadCase = (caseId: string) => {
    setUploadValidationMessage('');
    setUploadOpenCaseOverride((prev) => {
      const currentOpen = prev === COLLAPSED_UPLOAD_CASE
        ? ''
        : prev && uploadCases.some((item) => item.id === prev)
          ? prev
          : preferredUploadCaseId;
      return currentOpen === caseId ? COLLAPSED_UPLOAD_CASE : caseId;
    });
  };

  const addFamilyMember = () => {
    setFamilyMembers((prev) => [...prev, createBlankFamilyMember(familyCounter)]);
    setFamilyCounter((prev) => prev + 1);
  };

  const updateFamilyMember = (
    id: number,
    field: keyof Omit<FamilyMember, 'id'>,
    value: string,
  ) => {
    setFamilyMembers((prev) => prev.map((member) => (
      member.id === id
        ? { ...member, [field]: field === 'citizenId' ? normalizeDigits(value) : value }
        : member
    )));
  };

  const removeFamilyMember = (id: number) => {
    setFamilyMembers((prev) => prev.filter((member) => member.id !== id));
  };

  const applyCccdToApplicant = (info: CCCDInfo) => {
    setFieldValue('hoTen', info.hoTen || formState.values.hoTen || '');
    setFieldValue('ngaySinh', info.ngaySinh || formState.values.ngaySinh || '');
    setFieldValue('gioiTinh', normalizeGenderFromCccd(info.gioiTinh) || formState.values.gioiTinh || '');
    setFieldValue('cccd', normalizeCccdNumber(info.id || formState.values.cccd || ''));
    touchField('hoTen');
    touchField('ngaySinh');
    touchField('gioiTinh');
    touchField('cccd');
  };

  const applyCccdToFamilyMember = (info: CCCDInfo) => {
    const citizenId = normalizeCccdNumber(info.id || '');
    const duplicatedMember = citizenId
      ? normalizeCccdNumber(formState.values.cccd || '') === citizenId
        || familyMembers.some((member) => normalizeCccdNumber(member.citizenId) === citizenId)
      : false;

    if (duplicatedMember) {
      showToast('Trùng thông tin: số CCCD này đã có trong danh sách thành viên.');
      return false;
    }

    const cccdMember: Omit<FamilyMember, 'id'> = {
      fullName: info.hoTen || '',
      dateOfBirth: info.ngaySinh || '',
      gender: normalizeGenderFromCccd(info.gioiTinh),
      citizenId,
      relationshipWithHouseholder: '',
    };
    const blankMember = familyMembers.find(isBlankFamilyMember);

    if (blankMember) {
      setFamilyMembers((prev) => prev.map((member) => (
        member.id === blankMember.id ? { ...member, ...cccdMember } : member
      )));
      return true;
    }

    setFamilyMembers((prev) => [...prev, { id: familyCounter, ...cccdMember }]);
    setFamilyCounter((prev) => prev + 1);
    return true;
  };

  const handleSectionCccdUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsReadingCccd(true);
    try {
      const resizedFile = await ocrService.resizeImage(file);
      const info = await ocrService.extractCCCDInfo(resizedFile);
      const target = cccdTargetRef.current;

      if (target === 'applicant') {
        applyCccdToApplicant(info);
        showToast('Đã điền thông tin người đề nghị từ CCCD.');
      } else if (applyCccdToFamilyMember(info)) {
        showToast('Đã thêm thông tin thành viên từ CCCD.');
      }
    } catch (error) {
      console.error('Không đọc được CCCD cho mục thường trú:', error);
      showToast('Không đọc được CCCD. Vui lòng thử lại ảnh rõ hơn.');
    } finally {
      setIsReadingCccd(false);
      event.target.value = '';
    }
  };

  const openSectionCccdCamera = (target: ThuongTruCccdTarget) => {
    cccdTargetRef.current = target;
    cccdInputRef.current?.click();
  };

  const renderCccdHeaderAction = (target: ThuongTruCccdTarget, label: string) => (
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

  const addOverseasStayRow = () => {
    setOverseasStayRows((prev) => [...prev, createBlankOverseasStayRow(overseasStayCounter)]);
    setOverseasStayCounter((prev) => prev + 1);
  };

  const updateOverseasStayRow = (
    id: number,
    field: keyof Omit<OverseasStayRow, 'id'>,
    value: string,
  ) => {
    setOverseasStayRows((prev) => prev.map((row) => (
      row.id === id ? { ...row, [field]: value } : row
    )));
  };

  const removeOverseasStayRow = (id: number) => {
    setOverseasStayRows((prev) => prev.filter((row) => row.id !== id));
  };

  const addOverseasFamilyMember = () => {
    setOverseasFamilyMembers((prev) => [...prev, createBlankOverseasFamilyMember(overseasFamilyCounter)]);
    setOverseasFamilyCounter((prev) => prev + 1);
  };

  const updateOverseasFamilyMember = (
    id: number,
    field: keyof Omit<OverseasFamilyMember, 'id'>,
    value: string,
  ) => {
    setOverseasFamilyMembers((prev) => prev.map((member) => (
      member.id === id ? { ...member, [field]: value } : member
    )));
  };

  const removeOverseasFamilyMember = (id: number) => {
    setOverseasFamilyMembers((prev) => prev.filter((member) => member.id !== id));
  };

  const renderRadioChoice = (
    name: string,
    value: string,
    currentValue: string,
    title: string,
    description: string,
    onChange: () => void,
    disabled = false,
  ) => (
    <label className={`dktt-choice-card${disabled ? ' disabled' : ''}`}>
      <input
        type="radio"
        name={name}
        checked={currentValue === value}
        onChange={onChange}
        disabled={disabled}
      />
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </label>
  );

  const renderFamilyMembersTable = () => (
    <div style={{ marginTop: 28 }}>
      <div className="dktt-table-caption">
        <div className="dktt-sub-title" style={{ margin: 0, borderBottom: 'none' }}>
          Những thành viên trong hộ gia đình cùng thay đổi
        </div>
        <div className="dktt-table-caption-actions">
          <span className="dktt-badge dktt-badge-soft">Tùy chọn</span>
          {renderCccdHeaderAction('familyMember', 'Đọc CCCD và thêm thành viên')}
        </div>
      </div>
      <div className="dktt-member-table-wrapper">
        <table className="dktt-member-table">
          <thead>
            <tr>
              <th className="col-action">Thao tác</th>
              <th className="col-stt">STT</th>
              <th>Họ và tên <span className="req">(*)</span></th>
              <th>Ngày sinh <span className="req">(*)</span></th>
              <th>Giới tính <span className="req">(*)</span></th>
              <th>Số ĐDCN (CCCD) <span className="req">(*)</span></th>
              <th>Quan hệ với chủ hộ <span className="req">(*)</span></th>
            </tr>
          </thead>
          <tbody>
            {familyMembers.map((member, index) => {
              const errors = getStandardMemberErrors(member);
              const errorStyle = (field: keyof Omit<FamilyMember, 'id'>) => (
                errors[field] ? { borderColor: 'var(--danger)', background: 'var(--danger-subtle)' } : {}
              );

              return (
                <tr key={member.id}>
                  <td className="col-action">
                    {index === 0 ? (
                      <button type="button" className="dktt-btn-add" onClick={addFamilyMember} title="Thêm thành viên">
                        +
                      </button>
                    ) : (
                      <button type="button" className="dktt-btn-remove" onClick={() => removeFamilyMember(member.id)} title="Xóa dòng này">
                        ✕
                      </button>
                    )}
                  </td>
                  <td className="col-stt">{index + 1}</td>
                  <td>
                    <input
                      className="dktt-table-input"
                      type="text"
                      value={member.fullName}
                      onChange={(event) => updateFamilyMember(member.id, 'fullName', event.target.value)}
                      placeholder="Họ và tên"
                      style={errorStyle('fullName')}
                    />
                  </td>
                  <td>
                    <input
                      className="dktt-table-input"
                      type="date"
                      value={member.dateOfBirth}
                      onChange={(event) => updateFamilyMember(member.id, 'dateOfBirth', event.target.value)}
                      style={errorStyle('dateOfBirth')}
                    />
                  </td>
                  <td>
                    <select
                      className="dktt-table-select"
                      value={member.gender}
                      onChange={(event) => updateFamilyMember(member.id, 'gender', event.target.value)}
                      style={errorStyle('gender')}
                    >
                      <option value="">-- Chọn --</option>
                      {GENDER_OPTIONS.map((gender) => (
                        <option key={gender} value={gender}>{gender}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="dktt-table-input"
                      type="text"
                      maxLength={12}
                      value={member.citizenId}
                      onChange={(event) => updateFamilyMember(member.id, 'citizenId', event.target.value)}
                      placeholder="12 chữ số"
                      style={errorStyle('citizenId')}
                    />
                  </td>
                  <td>
                    <select
                      className="dktt-table-select"
                      value={member.relationshipWithHouseholder}
                      onChange={(event) => updateFamilyMember(member.id, 'relationshipWithHouseholder', event.target.value)}
                      style={errorStyle('relationshipWithHouseholder')}
                    >
                      <option value="">-- Chọn --</option>
                      {HOUSEHOLD_RELATIONSHIP_OPTIONS.map((relationship) => (
                        <option key={relationship} value={relationship}>{relationship}</option>
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
        Bảng này chỉ cần khai khi có thêm nhân khẩu cùng thay đổi thường trú. Nếu đã nhập một dòng thì cần điền đủ toàn bộ cột bắt buộc của dòng đó.
      </p>
    </div>
  );

  const renderOverseasStayTable = () => (
    <div style={{ marginTop: 24 }}>
      <div className="dktt-table-caption">
        <div className="dktt-sub-title" style={{ margin: 0, borderBottom: 'none' }}>
          Quá trình cư trú, lao động, học tập ở nước ngoài trước khi nhập cảnh
        </div>
        <button type="button" className="dktt-inline-action" onClick={addOverseasStayRow}>
          + Thêm dòng
        </button>
      </div>
      <div className="dktt-member-table-wrapper">
        <table className="dktt-member-table">
          <thead>
            <tr>
              <th className="col-action">Xóa</th>
              <th className="col-stt">STT</th>
              <th>Từ ngày <span className="req">(*)</span></th>
              <th>Đến ngày</th>
              <th>Nơi cư trú <span className="req">(*)</span></th>
              <th>Nghề nghiệp, nơi làm việc <span className="req">(*)</span></th>
            </tr>
          </thead>
          <tbody>
            {overseasStayRows.map((row, index) => {
              const errors = getOverseasStayErrors(row);
              const errorStyle = (field: keyof Omit<OverseasStayRow, 'id'>) => (
                errors[field] ? { borderColor: 'var(--danger)', background: 'var(--danger-subtle)' } : {}
              );

              return (
                <tr key={row.id}>
                  <td className="col-action">
                    {index === 0 ? (
                      <span className="dktt-table-placeholder">-</span>
                    ) : (
                      <button type="button" className="dktt-btn-remove" onClick={() => removeOverseasStayRow(row.id)}>
                        ✕
                      </button>
                    )}
                  </td>
                  <td className="col-stt">{index + 1}</td>
                  <td>
                    <input
                      className="dktt-table-input"
                      type="date"
                      value={row.fromDate}
                      onChange={(event) => updateOverseasStayRow(row.id, 'fromDate', event.target.value)}
                      style={errorStyle('fromDate')}
                    />
                  </td>
                  <td>
                    <input
                      className="dktt-table-input"
                      type="date"
                      value={row.toDate}
                      onChange={(event) => updateOverseasStayRow(row.id, 'toDate', event.target.value)}
                      style={errorStyle('toDate')}
                    />
                  </td>
                  <td>
                    <input
                      className="dktt-table-input"
                      type="text"
                      value={row.residenceAddress}
                      onChange={(event) => updateOverseasStayRow(row.id, 'residenceAddress', event.target.value)}
                      placeholder="Quốc gia, thành phố, địa chỉ"
                      style={errorStyle('residenceAddress')}
                    />
                  </td>
                  <td>
                    <input
                      className="dktt-table-input"
                      type="text"
                      value={row.occupation}
                      onChange={(event) => updateOverseasStayRow(row.id, 'occupation', event.target.value)}
                      placeholder="Nghề nghiệp, nơi làm việc"
                      style={errorStyle('occupation')}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderOverseasFamilyTable = () => (
    <div style={{ marginTop: 24 }}>
      <div className="dktt-table-caption">
        <div className="dktt-sub-title" style={{ margin: 0, borderBottom: 'none' }}>
          Thành viên gia đình đi cùng hoặc có liên quan
        </div>
        <button type="button" className="dktt-inline-action" onClick={addOverseasFamilyMember}>
          + Thêm người
        </button>
      </div>
      <div className="dktt-member-table-wrapper">
        <table className="dktt-member-table">
          <thead>
            <tr>
              <th className="col-action">Xóa</th>
              <th className="col-stt">STT</th>
              <th>Họ và tên <span className="req">(*)</span></th>
              <th>Ngày sinh <span className="req">(*)</span></th>
              <th>Quốc tịch <span className="req">(*)</span></th>
              <th>Quan hệ <span className="req">(*)</span></th>
              <th>Nghề nghiệp, nơi làm việc</th>
              <th>Nơi ở hiện tại <span className="req">(*)</span></th>
            </tr>
          </thead>
          <tbody>
            {overseasFamilyMembers.map((member, index) => {
              const errors = getOverseasFamilyErrors(member);
              const errorStyle = (field: keyof Omit<OverseasFamilyMember, 'id'>) => (
                errors[field] ? { borderColor: 'var(--danger)', background: 'var(--danger-subtle)' } : {}
              );

              return (
                <tr key={member.id}>
                  <td className="col-action">
                    {index === 0 ? (
                      <span className="dktt-table-placeholder">-</span>
                    ) : (
                      <button type="button" className="dktt-btn-remove" onClick={() => removeOverseasFamilyMember(member.id)}>
                        ✕
                      </button>
                    )}
                  </td>
                  <td className="col-stt">{index + 1}</td>
                  <td>
                    <input
                      className="dktt-table-input"
                      type="text"
                      value={member.fullName}
                      onChange={(event) => updateOverseasFamilyMember(member.id, 'fullName', event.target.value)}
                      placeholder="Họ và tên"
                      style={errorStyle('fullName')}
                    />
                  </td>
                  <td>
                    <input
                      className="dktt-table-input"
                      type="date"
                      value={member.dateOfBirth}
                      onChange={(event) => updateOverseasFamilyMember(member.id, 'dateOfBirth', event.target.value)}
                      style={errorStyle('dateOfBirth')}
                    />
                  </td>
                  <td>
                    <select
                      className="dktt-table-select"
                      value={member.nationality}
                      onChange={(event) => updateOverseasFamilyMember(member.id, 'nationality', event.target.value)}
                      style={errorStyle('nationality')}
                    >
                      <option value="">-- Chọn --</option>
                      {NATIONALITY_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="dktt-table-select"
                      value={member.relationship}
                      onChange={(event) => updateOverseasFamilyMember(member.id, 'relationship', event.target.value)}
                      style={errorStyle('relationship')}
                    >
                      <option value="">-- Chọn --</option>
                      {HOUSEHOLD_RELATIONSHIP_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="dktt-table-input"
                      type="text"
                      value={member.occupation}
                      onChange={(event) => updateOverseasFamilyMember(member.id, 'occupation', event.target.value)}
                      placeholder="Nếu có"
                      style={errorStyle('occupation')}
                    />
                  </td>
                  <td>
                    <input
                      className="dktt-table-input"
                      type="text"
                      value={member.currentAddress}
                      onChange={(event) => updateOverseasFamilyMember(member.id, 'currentAddress', event.target.value)}
                      placeholder="Nơi ở hiện tại"
                      style={errorStyle('currentAddress')}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderProcedureSection = () => (
    <div>
      {renderServiceFields(['thuTuc'], 'cols-1')}
      {renderServiceFields(['truongHop'], 'cols-1')}

      <div className="dktt-choice-group">
        <div className="dktt-sub-title">Loại đăng ký thường trú</div>
        <div className="dktt-choice-grid">
          {renderRadioChoice(
            'loaiDKTT',
            'lap_ho_moi',
            registrationMode,
            'Đăng ký thường trú lập hộ mới',
            'Người đăng ký đồng thời là chủ hộ mới. Hệ thống sẽ tự đồng bộ thông tin chủ hộ từ người đăng ký.',
            () => handleFieldChange('loaiDKTT', 'lap_ho_moi'),
            isFirstRegistration,
          )}
          {renderRadioChoice(
            'loaiDKTT',
            'vao_ho_co',
            registrationMode,
            'Đăng ký thường trú vào hộ đã có',
            'Yêu cầu khai thêm thông tin chủ hộ và quan hệ với chủ hộ hiện tại.',
            () => handleFieldChange('loaiDKTT', 'vao_ho_co'),
            false,
          )}
        </div>
      </div>

      <label className="dktt-checkbox-line">
        <input
          type="checkbox"
          checked={isOverseasDossier}
          onChange={(event) => handleFieldChange(OVERSEAS_TOGGLE_FIELD, String(event.target.checked))}
        />
        <span>
          CD Việt Nam định cư ở nước ngoài không có hộ chiếu Việt Nam còn giá trị sử dụng
        </span>
      </label>
    </div>
  );

  const renderHouseholderSection = () => {
    const relationField = createSelectField(
      HOUSEHOLDER_RELATION_FIELD_ID,
      'Quan hệ với chủ hộ',
      buildOptions(['Chủ hộ']),
      true,
    );

    return (
      <div className="dktt-panel" style={{ marginTop: 24 }}>
        <div className="dktt-table-caption" style={{ marginBottom: 14 }}>
          <div className="dktt-sub-title" style={{ margin: 0, borderBottom: 'none' }}>
            Thông tin chủ hộ
          </div>
          <span className="dktt-badge dktt-badge-primary">Tự động</span>
        </div>
        {renderFields([
          createTextField(HOUSEHOLDER_NAME_FIELD_ID, 'Họ tên chủ hộ', true, 'Họ và tên chủ hộ'),
          relationField,
          createTextField(HOUSEHOLDER_DOCUMENT_FIELD_ID, 'Số giấy tờ của chủ hộ', true, '9 hoặc 12 chữ số'),
        ], 'cols-3', [
          HOUSEHOLDER_NAME_FIELD_ID,
          HOUSEHOLDER_RELATION_FIELD_ID,
          HOUSEHOLDER_DOCUMENT_FIELD_ID,
        ])}
      </div>
    );
  };

  const renderRequestSection = () => (
    <div>
      <div className="dktt-sub-title">Nơi đề nghị ĐKTT</div>
      {renderServiceFields(['tinhThanhDN', 'xaPhuongDN'], 'cols-2')}
      {renderServiceFields(['diaChiDN'], 'cols-1')}
      {renderHouseholderSection()}
      {renderServiceFields(['noiDungDN'], 'cols-1')}
    </div>
  );

  const renderOverseasSection = () => (
    <div className="dktt-panel dktt-panel-muted" style={{ marginTop: 24 }}>
      <div className="dktt-flag-note">
        <Info size={16} />
        <span>
          Dành cho công dân Việt Nam định cư ở nước ngoài không còn hộ chiếu Việt Nam hợp lệ.
        </span>
      </div>

      {renderFields([
        createTextField('ct02HoTenNuocNgoai', 'Họ tên bằng tiếng nước ngoài', true, 'Theo giấy tờ nước ngoài'),
        createTextField('ct02QuocTichKhac', 'Quốc tịch khác (nếu có)', false, 'Ví dụ: Hoa Kỳ'),
      ], 'cols-2')}

      {renderFields([
        createTextField('ct02SoGiayToNN', 'Số hộ chiếu/giấy tờ đi lại quốc tế', true, 'Số hộ chiếu hoặc giấy tờ đi lại'),
        createDateField('ct02NgayCapGiayTo', 'Ngày cấp', true),
        createDateField('ct02NgayHetHan', 'Ngày hết hạn', true),
      ], 'cols-3')}

      {renderFields([
        createTextField('ct02NoiCapGiayTo', 'Cơ quan cấp', true, 'Tên cơ quan cấp giấy tờ'),
        createTextField('ct02NgheNghiepNuocNgoai', 'Nghề nghiệp ở nước ngoài', true, 'Ví dụ: Kỹ sư phần mềm'),
        createTextField('ct02NoiLamViecNuocNgoai', 'Nơi làm việc/học tập ở nước ngoài', true, 'Tên công ty, trường học...'),
      ], 'cols-3')}

      <div className="dktt-form-row cols-3">
        <div className="form-group">
          <label className="form-label" htmlFor={OVERSEAS_PHOTO_FIELD_ID}>
            Ảnh chân dung 4x6
            <span className="required"> *</span>
          </label>
          <label className={`dktt-photo-box${formState.errors[OVERSEAS_PHOTO_FIELD_ID] ? ' error' : ''}`} htmlFor={OVERSEAS_PHOTO_FIELD_ID}>
            <input
              id={OVERSEAS_PHOTO_FIELD_ID}
              type="file"
              accept="image/png,image/jpeg,image/heic,image/heif,.heic,.heif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setCt02PhotoName(file?.name || '');
                setFieldError(OVERSEAS_PHOTO_FIELD_ID, '');
              }}
            />
            <span>{ct02PhotoName || 'Tải ảnh 4x6'}</span>
          </label>
          {formState.errors[OVERSEAS_PHOTO_FIELD_ID] && (
            <span className="form-error-msg" role="alert">
              ⚠️ {formState.errors[OVERSEAS_PHOTO_FIELD_ID]}
            </span>
          )}
        </div>
      </div>

      {renderFields([
        createTextField('ct02NoiThuongTruNuocNgoai', 'Quốc gia/nơi thường trú ở nước ngoài', true, 'Quốc gia, bang/tỉnh'),
        createTextareaField('ct02DiaChiNuocNgoai', 'Địa chỉ cư trú ở nước ngoài', true, 'Địa chỉ đầy đủ ở nước ngoài'),
      ], 'cols-2')}

      {renderFields([
        createSelectField('ct02TinhThanhVN', 'Tỉnh/Thành phố hiện đang cư trú tại Việt Nam', provinceOptions || [], true),
        createSelectField('ct02XaPhuongVN', 'Xã/Phường/Đặc khu hiện đang cư trú', ct02WardOptions || [], true),
      ], 'cols-2', [
        ...(isLoadingProvinces ? ['ct02TinhThanhVN'] : []),
        ...(!selectedCt02Province || isLoadingCt02Wards ? ['ct02XaPhuongVN'] : []),
      ])}

      {renderFields([
        createTextareaField(
          'ct02DiaChiVN',
          'Địa chỉ chi tiết tại Việt Nam',
          true,
          'Số nhà, đường, thôn/xóm/ấp/bản...',
        ),
      ], 'cols-1')}

      {renderOverseasStayTable()}
      {renderOverseasFamilyTable()}
    </div>
  );

  const renderApplicantSection = () => (
    <div>
      <div className="dktt-choice-group" style={{ marginBottom: 20 }}>
        <div className="dktt-choice-grid">
          {renderRadioChoice(
            DECLARE_MODE_FIELD,
            'self',
            declareMode,
            'Người khai là người đăng ký thường trú',
            'Nếu dữ liệu công dân đã có sẵn thì các trường định danh sẽ được khóa giống luồng cổng dịch vụ công.',
            () => handleFieldChange(DECLARE_MODE_FIELD, 'self'),
          )}
          {renderRadioChoice(
            DECLARE_MODE_FIELD,
            'proxy',
            declareMode,
            'Khai hộ',
            'Cho phép nhập tay đầy đủ thông tin người được khai hộ để đối chiếu với dữ liệu dân cư.',
            () => handleFieldChange(DECLARE_MODE_FIELD, 'proxy'),
          )}
        </div>
      </div>

      {renderServiceFields(['hoTen', 'ngaySinh', 'gioiTinh'], 'cols-3')}
      {renderServiceFields(['danToc', 'tonGiao'], 'cols-2')}
      {renderServiceFields(['cccd', 'sdt', 'email'], 'cols-3')}
      {isOverseasDossier ? renderOverseasSection() : renderFamilyMembersTable()}
    </div>
  );

  const renderUploadSection = () => {
    return (
      <div>
        <div className="dktt-upload-summary">
          <p className="dktt-note" style={{ marginBottom: 8 }}>
            Vui lòng chọn trường hợp và đính kèm các tập tin hình ảnh về các loại giấy tờ sau để giúp cơ quan chức năng xác minh và giải quyết hồ sơ của ông/bà.
          </p>
          <p className="dktt-upload-meta">
            Mỗi thời điểm áp dụng một trường hợp hồ sơ. Các giấy tờ bắt buộc luôn được giữ ở trạng thái chọn; các giấy tờ có thể khai thác CSDL chuyên ngành thì không bắt buộc tải file lên.
          </p>
          {uploadValidationMessage && (
            <p className="form-error-msg" role="alert" style={{ marginTop: 10 }}>
              ⚠️ {uploadValidationMessage}
            </p>
          )}
        </div>

        <div className="dktt-upload-case-list">
          {uploadCases.map((item) => {
            const isOpen = openUploadCaseId === item.id;

            return (
              <div key={item.id} className={`dktt-upload-case${isOpen ? ' open' : ''}`}>
                <button
                  type="button"
                  className="dktt-upload-case-header"
                  onClick={() => toggleUploadCase(item.id)}
                  aria-expanded={isOpen}
                >
                  <div className="dktt-upload-case-title">
                    <span className="dktt-upload-case-bullet">-</span>
                    <span>{item.title}</span>
                  </div>
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {isOpen && (
                  <div className="dktt-upload-case-body">
                    <div className="dktt-member-table-wrapper dktt-doc-table-wrapper">
                      <table className="dktt-member-table dktt-doc-table">
                        <thead>
                          <tr>
                            <th className="dktt-doc-col-stt">STT</th>
                            <th className="dktt-doc-col-pick" />
                            <th className="dktt-doc-col-name">Tên giấy tờ</th>
                            <th className="dktt-doc-col-kind">Loại giấy tờ</th>
                            <th className="dktt-doc-col-template">Tải file mẫu</th>
                            <th className="dktt-doc-col-specialized">Khai thác CSDL chuyên ngành/ Biểu mẫu điện tử</th>
                            <th className="dktt-doc-col-attach">Đính kèm</th>
                            <th className="dktt-doc-col-quantity">Số lượng</th>
                            <th className="dktt-doc-col-note">Ghi chú</th>
                            <th className="dktt-doc-col-action">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.requirements.map((requirement, index) => {
                            const draft = getUploadDraft(item.id, requirement);
                            const isActive = draft.checked || requirement.required;
                            const canUseSpecializedData = requirement.canUseSpecializedData && !SPECIALIZED_DATA_TEMP_DISABLED;
                            const disableAttachment = !isActive || (canUseSpecializedData && draft.useSpecializedData);

                            return (
                              <tr key={requirement.id}>
                                <td className="dktt-doc-cell-center dktt-doc-cell-stt">{index + 1}</td>
                                <td className="dktt-doc-cell-center dktt-doc-cell-pick">
                                  <input
                                    className="dktt-doc-checkbox"
                                    type="checkbox"
                                    checked={draft.checked}
                                    onChange={(event) => toggleUploadRequirement(item.id, requirement, event.target.checked)}
                                    disabled={requirement.required}
                                  />
                                </td>
                                <td>
                                  <div className="dktt-doc-name">
                                    <strong>{requirement.name}</strong>
                                  </div>
                                </td>
                                <td>
                                  <select
                                    className="dktt-table-select dktt-doc-select"
                                    value={draft.kind}
                                    onChange={(event) => patchUploadDraft(item.id, requirement, { kind: event.target.value })}
                                    disabled={!isActive}
                                  >
                                    {(requirement.kindOptions || ['Bản gốc']).map((kind) => (
                                      <option key={kind} value={kind}>{kind}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="dktt-doc-cell-center">
                                  {requirement.templateAvailable ? (
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
                                    <span className="dktt-table-placeholder">-</span>
                                  )}
                                </td>
                                <td>
                                  {canUseSpecializedData ? (
                                    <label className={`dktt-doc-specialized${isActive ? '' : ' disabled'}`}>
                                      <input
                                        type="checkbox"
                                        checked={draft.useSpecializedData}
                                        onChange={(event) => toggleSpecializedData(item.id, requirement, event.target.checked)}
                                        disabled={!isActive}
                                      />
                                      <span className="dktt-doc-chip">
                                        <Database size={12} />
                                        Sử dụng dữ liệu
                                      </span>
                                    </label>
                                  ) : (
                                    <span className="dktt-table-placeholder">Không áp dụng</span>
                                  )}
                                </td>
                                <td>
                                  <label className={`dktt-doc-attach${disableAttachment ? ' disabled' : ''}`}>
                                    <input
                                      type="file"
                                      accept="image/png,image/jpeg,image/heic,image/heif,.heic,.heif,application/pdf"
                                      multiple
                                      disabled={disableAttachment}
                                      onChange={(event) => updateUploadFiles(item.id, requirement, event.target.files)}
                                    />
                                    <Paperclip size={14} />
                                    <span>
                                      {canUseSpecializedData && draft.useSpecializedData
                                        ? 'Đang dùng dữ liệu'
                                        : draft.fileNames.length > 0
                                          ? `${draft.fileNames.length} file`
                                          : 'Chọn file'}
                                    </span>
                                  </label>
                                  {!(canUseSpecializedData && draft.useSpecializedData) && draft.fileNames.length > 0 && (
                                    <div className="dktt-doc-file-list">
                                      {draft.fileNames.slice(0, 3).map((fileName) => (
                                        <span key={fileName} className="attachment-review-inline">
                                          <span>{fileName}</span>
                                          <AttachmentReviewBadge review={draft.reviewByFileName?.[fileName]} />
                                        </span>
                                      ))}
                                      {draft.fileNames.length > 3 && (
                                        <span>+{draft.fileNames.length - 3} file khác</span>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <input
                                    className="dktt-table-input dktt-doc-qty-input"
                                    type="text"
                                    inputMode="numeric"
                                    value={draft.quantity}
                                    onChange={(event) => patchUploadDraft(item.id, requirement, {
                                      quantity: event.target.value.replace(/\D/g, '').slice(0, 2),
                                    })}
                                    disabled={!isActive}
                                    placeholder="1"
                                  />
                                </td>
                                <td>
                                  <input
                                    className="dktt-table-input dktt-doc-note-input"
                                    type="text"
                                    value={draft.note}
                                    onChange={(event) => patchUploadDraft(item.id, requirement, { note: event.target.value })}
                                    disabled={!isActive}
                                    placeholder="Ghi chú"
                                  />
                                </td>
                                <td className="dktt-doc-cell-center">
                                  <label className={`dktt-doc-icon-btn${disableAttachment ? ' disabled' : ''}`} title="Thêm tệp đính kèm">
                                    <input
                                      type="file"
                                      accept="image/png,image/jpeg,image/heic,image/heif,.heic,.heif,application/pdf"
                                      multiple
                                      disabled={disableAttachment}
                                      onChange={(event) => updateUploadFiles(item.id, requirement, event.target.files, 'append')}
                                    />
                                    <Plus size={14} />
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
      </div>
    );
  };

  const renderNotificationSection = () => {
    const notificationFields: FormField[] = [
      fieldMap.get('hinhThucNhanTB'),
      ...(notificationMethod === 'sms' ? [fieldMap.get('sdtNhanTB')] : []),
      ...(notificationMethod === 'email' ? [fieldMap.get('emailNhanTB')] : []),
      fieldMap.get('hinhThucNhanKQ'),
    ].filter(Boolean) as FormField[];

    const resultFields: FormField[] = [];
    if (resultMethod === 'buu_dien') {
      resultFields.push(
        createTextareaField(POSTAL_ADDRESS_FIELD_ID, 'Địa chỉ nhận kết quả qua bưu điện', true, 'Địa chỉ nhận kết quả'),
        createPhoneField(POSTAL_PHONE_FIELD_ID, 'Số điện thoại người nhận', true, '0901234567'),
      );
    }

    return (
      <div>
        {renderFields(notificationFields, notificationFields.length > 2 ? 'cols-3' : 'cols-2')}
        {resultFields.length > 0 && (
          <div className="dktt-panel" style={{ marginTop: 20 }}>
            <div className="dktt-sub-title" style={{ marginTop: 0 }}>
              Thông tin nhận kết quả qua bưu điện
            </div>
            {renderFields(resultFields, 'cols-2')}
          </div>
        )}
      </div>
    );
  };

  const renderVNeIDSection = () => (
    <div>
      <div className="dktt-vneid-box">
        <em>
          Công dân kê khai các thông tin sau nếu cần lấy ý kiến đồng ý của chủ hộ, chủ sở hữu chỗ ở hợp pháp hoặc cha/mẹ/người giám hộ qua ứng dụng định danh điện tử.
        </em>
      </div>

      <div className="dktt-form-row cols-2">
        <div className="form-group">
          <label className="form-label">Trạng thái xác nhận</label>
          <input className="form-input" type="text" value="Chưa gửi" disabled style={{ background: 'var(--gray-50)' }} />
        </div>
      </div>

      <div className="dktt-sub-title">Người kê khai là:</div>
      <div className="dktt-form-row cols-3">
        <label className="dktt-checkbox-line compact">
          <input type="checkbox" />
          <span>Chủ hộ</span>
        </label>
        <label className="dktt-checkbox-line compact">
          <input type="checkbox" />
          <span>Chủ sở hữu chỗ ở hợp pháp</span>
        </label>
        <label className="dktt-checkbox-line compact">
          <input type="checkbox" />
          <span>Cha/Mẹ/Người giám hộ</span>
        </label>
      </div>

      <div className="dktt-sub-title" style={{ marginTop: 20 }}>Danh sách người cần xin ý kiến</div>
      <div className="dktt-empty-state">
        Chưa có dữ liệu.
      </div>

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <em style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          *Vui lòng kiểm tra tính chính xác của tài khoản định danh điện tử đã cung cấp
        </em>
        <br />
        <button className="btn dktt-vneid-btn">
          Kiểm tra tài khoản VNeID
        </button>
      </div>
    </div>
  );

  const validateField = (field: FormField, sectionId: string, errorSections: Set<string>): boolean => {
    touchField(field.id);
    const error = validateServiceField(field, getFieldValue(field.id));
    setFieldError(field.id, error);
    if (error) errorSections.add(sectionId);
    return !error;
  };

  const validateCustomField = (
    field: FormField,
    sectionId: string,
    errorSections: Set<string>,
    validator?: (value: string) => string,
  ): boolean => {
    touchField(field.id);
    const value = getFieldValue(field.id);
    const error = validator ? validator(value) : validateServiceField(field, value);
    setFieldError(field.id, error);
    if (error) errorSections.add(sectionId);
    return !error;
  };

  const handleSubmit = async () => {
    const errorSections = new Set<string>();
    setUploadValidationMessage('');

    if (!agreedLegal) {
      errorSections.add('nhan-thong-bao');
      alert('Vui lòng xác nhận chịu trách nhiệm trước pháp luật về lời khai trên.');
      openErrorSections([...errorSections]);
      return;
    }

    const visibleServiceFieldIds = [
      'tinhThanhCQ',
      'xaPhuongCQ',
      'coQuanDKCT',
      'sdtCoQuan',
      'thuTuc',
      'truongHop',
      'loaiDKTT',
      'hoTen',
      'ngaySinh',
      'gioiTinh',
      'danToc',
      'tonGiao',
      'cccd',
      'sdt',
      'email',
      'tinhThanhDN',
      'xaPhuongDN',
      'diaChiDN',
      'noiDungDN',
      'hinhThucNhanTB',
      ...(notificationMethod === 'sms' ? ['sdtNhanTB'] : []),
      ...(notificationMethod === 'email' ? ['emailNhanTB'] : []),
      'hinhThucNhanKQ',
    ];

    visibleServiceFieldIds.forEach((fieldId) => {
      const field = fieldMap.get(fieldId);
      if (!field) return;

      const sectionId = ['tinhThanhCQ', 'xaPhuongCQ', 'coQuanDKCT', 'sdtCoQuan'].includes(fieldId)
        ? 'co-quan'
        : ['thuTuc', 'truongHop', 'loaiDKTT'].includes(fieldId)
          ? 'thu-tuc'
          : ['tinhThanhDN', 'xaPhuongDN', 'diaChiDN', 'noiDungDN'].includes(fieldId)
            ? 'thong-tin-de-nghi'
            : ['hinhThucNhanTB', 'sdtNhanTB', 'emailNhanTB', 'hinhThucNhanKQ'].includes(fieldId)
              ? 'nhan-thong-bao'
              : 'nguoi-de-nghi';
      validateField(field, sectionId, errorSections);
    });

    validateCustomField(
      createTextField(HOUSEHOLDER_NAME_FIELD_ID, 'Họ tên chủ hộ', true),
      'thong-tin-de-nghi',
      errorSections,
      (value) => {
        if (!value.trim()) return 'Vui lòng nhập họ tên chủ hộ';
        if (value.trim().length > 50) return 'Họ tên chủ hộ không được vượt quá 50 ký tự';
        return isLikelyValidFullName(value) ? '' : 'Họ tên chủ hộ không hợp lệ';
      },
    );

    validateCustomField(
      createSelectField(HOUSEHOLDER_RELATION_FIELD_ID, 'Quan hệ với chủ hộ', [], true),
      'thong-tin-de-nghi',
      errorSections,
      (value) => value.trim() ? '' : 'Vui lòng chọn quan hệ với chủ hộ',
    );

    validateCustomField(
      createTextField(HOUSEHOLDER_DOCUMENT_FIELD_ID, 'Số giấy tờ của chủ hộ', true),
      'thong-tin-de-nghi',
      errorSections,
      (value) => {
        if (!value.trim()) return 'Vui lòng nhập số giấy tờ của chủ hộ';
        return isValidCitizenId(value, [9, 12]) ? '' : 'Số giấy tờ của chủ hộ phải có 9 hoặc 12 chữ số';
      },
    );

    validateCustomField(
      createTextareaField('diaChiDN', 'Địa chỉ nơi đề nghị đăng ký thường trú', true),
      'thong-tin-de-nghi',
      errorSections,
      (value) => validateAddressDetail(value, selectedRequestProvinceLabel, selectedRequestWardLabel),
    );

    if (resultMethod === 'buu_dien') {
      validateCustomField(
        createTextareaField(POSTAL_ADDRESS_FIELD_ID, 'Địa chỉ nhận kết quả qua bưu điện', true),
        'nhan-thong-bao',
        errorSections,
      );
      validateCustomField(
        createPhoneField(POSTAL_PHONE_FIELD_ID, 'Số điện thoại người nhận', true),
        'nhan-thong-bao',
        errorSections,
        (value) => {
          if (!value.trim()) return 'Vui lòng nhập số điện thoại người nhận';
          return isValidVietnamesePhone(value) ? '' : 'Số điện thoại người nhận không hợp lệ';
        },
      );
    }

    const selectedUploadCase = uploadCases.find((item) => item.id === openUploadCaseId);
    if (!selectedUploadCase) {
      errorSections.add('ho-so-dinh-kem');
      setUploadValidationMessage('Vui lòng chọn một trường hợp hồ sơ phù hợp trước khi nộp.');
    } else {
      const uploadErrors: string[] = [];

      selectedUploadCase.requirements.forEach((requirement) => {
        const draft = getUploadDraft(selectedUploadCase.id, requirement);
        const isSelected = requirement.required || draft.checked;
        const canUseSpecializedData = requirement.canUseSpecializedData && !SPECIALIZED_DATA_TEMP_DISABLED;

        if (!isSelected) return;

        const quantity = Number(draft.quantity);
        if (!draft.quantity || Number.isNaN(quantity) || quantity <= 0) {
          uploadErrors.push(`Số lượng của "${requirement.name}" phải lớn hơn 0.`);
        }

        if (draft.note.trim().length > 250) {
          uploadErrors.push(`Ghi chú của "${requirement.name}" không được vượt quá 250 ký tự.`);
        }

        if ((!canUseSpecializedData || !draft.useSpecializedData) && draft.fileNames.length === 0) {
          uploadErrors.push(`"${requirement.name}" cần có tệp đính kèm hoặc chọn khai thác dữ liệu.`);
        }
      });

      if (uploadErrors.length > 0) {
        errorSections.add('ho-so-dinh-kem');
        setUploadValidationMessage(uploadErrors[0]);
        setOpenSections((prev) => ({ ...prev, 'ho-so-dinh-kem': true }));
      }
    }

    if (isOverseasDossier) {
      const overseasFields = [
        createTextField('ct02HoTenNuocNgoai', 'Họ tên bằng tiếng nước ngoài', true),
        createTextField('ct02SoGiayToNN', 'Số hộ chiếu/giấy tờ đi lại quốc tế', true),
        createDateField('ct02NgayCapGiayTo', 'Ngày cấp', true),
        createDateField('ct02NgayHetHan', 'Ngày hết hạn', true),
        createTextField('ct02NoiCapGiayTo', 'Cơ quan cấp', true),
        createTextField('ct02NgheNghiepNuocNgoai', 'Nghề nghiệp ở nước ngoài', true),
        createTextField('ct02NoiLamViecNuocNgoai', 'Nơi làm việc/học tập ở nước ngoài', true),
        createTextField('ct02NoiThuongTruNuocNgoai', 'Quốc gia/nơi thường trú ở nước ngoài', true),
        createTextareaField('ct02DiaChiNuocNgoai', 'Địa chỉ cư trú ở nước ngoài', true),
        createSelectField('ct02TinhThanhVN', 'Tỉnh/Thành phố hiện đang cư trú tại Việt Nam', provinceOptions || [], true),
        createSelectField('ct02XaPhuongVN', 'Xã/Phường/Đặc khu hiện đang cư trú', ct02WardOptions || [], true),
      ];

      overseasFields.forEach((field) => validateCustomField(field, 'nguoi-de-nghi', errorSections));

      validateCustomField(
        createTextareaField('ct02DiaChiVN', 'Địa chỉ chi tiết tại Việt Nam', true),
        'nguoi-de-nghi',
        errorSections,
        (value) => validateAddressDetail(value, selectedCt02ProvinceLabel, selectedCt02WardLabel),
      );

      validateCustomField(
        createDateField('ct02NgayCapGiayTo', 'Ngày cấp', true),
        'nguoi-de-nghi',
        errorSections,
        (value) => {
          if (!value) return 'Vui lòng chọn ngày cấp';
          if (compareDates(value, new Date().toISOString().slice(0, 10)) > 0) {
            return 'Ngày cấp không được lớn hơn ngày hiện tại';
          }
          return '';
        },
      );

      validateCustomField(
        createDateField('ct02NgayHetHan', 'Ngày hết hạn', true),
        'nguoi-de-nghi',
        errorSections,
        (value) => {
          if (!value) return 'Vui lòng chọn ngày hết hạn';
          const issueDate = getFieldValue('ct02NgayCapGiayTo');
          if (issueDate && compareDates(issueDate, value) > 0) {
            return 'Ngày hết hạn phải từ ngày cấp trở đi';
          }
          return '';
        },
      );

      setFieldError(OVERSEAS_PHOTO_FIELD_ID, ct02PhotoName ? '' : 'Vui lòng tải ảnh chân dung 4x6');
      if (!ct02PhotoName) errorSections.add('nguoi-de-nghi');

      const openEndedRows = overseasStayRows.filter((row) => row.fromDate.trim() && !row.toDate.trim()).length;
      if (openEndedRows > 1) {
        errorSections.add('nguoi-de-nghi');
      }

      overseasStayRows.forEach((row) => {
        if (Object.keys(getOverseasStayErrors(row)).length > 0) {
          errorSections.add('nguoi-de-nghi');
        }
      });

      overseasFamilyMembers.forEach((member) => {
        if (Object.keys(getOverseasFamilyErrors(member)).length > 0) {
          errorSections.add('nguoi-de-nghi');
        }
      });
    } else {
      familyMembers.forEach((member) => {
        if (Object.keys(getStandardMemberErrors(member)).length > 0) {
          errorSections.add('nguoi-de-nghi');
        }
      });
    }

    if (errorSections.size > 0) {
      openErrorSections([...errorSections]);
      alert('Vui lòng kiểm tra lại các trường đang hiển thị trong biểu mẫu đăng ký thường trú.');
      return;
    }

    const allFilesToUpload: File[] = [];
    Object.values(uploadDrafts).forEach((draft) => {
      if (draft.checked && draft.files && draft.files.length > 0) {
        allFilesToUpload.push(...draft.files);
      }
    });

    const attachments = await Promise.all(allFilesToUpload.map(file => saveAttachmentFile(file)));

    const extractedDocs: DashboardDocument[] = [];
    Object.values(uploadDrafts).forEach((draft) => {
      if (draft.checked) {
        if (draft.fileNames.length > 0) {
          draft.fileNames.forEach((name) => extractedDocs.push({ name, state: 'Đã có' }));
        } else if (draft.useSpecializedData) {
          extractedDocs.push({ name: 'Dữ liệu chuyên ngành', state: 'Đã có' });
        } else {
          extractedDocs.push({ name: 'Chưa tải file đính kèm', state: 'Cần kiểm tra' });
        }
      }
    });

    saveApplicationToDashboard({
      procedure: 'Đăng ký thường trú',
      applicant: formState.values.hoTen || '',
      citizenId: formState.values.cccd || '',
      phone: formState.values.sdt || '',
      email: formState.values.email || '',
      documents: extractedDocs,
      attachments,
      message: 'Xin chào bộ phận tiếp nhận. Tôi đã nộp đầy đủ hồ sơ theo yêu cầu.',
      details: {
        'Tỉnh/Thành phố đề nghị': formState.values.tinhThanhDN || '',
        'Quận/Huyện đề nghị': formState.values.quanHuyenDN || '',
        'Phường/Xã đề nghị': formState.values.xaPhuongDN || '',
        'Địa chỉ hiện tại': formState.values.ct02DiaChiVN || '',
        'Cơ quan tiếp nhận': formState.values.coQuanDKCT || '',
        'Chủ hộ': formState.values.hoTenChuHo || '',
        'Quan hệ với chủ hộ': formState.values.quanHeVoiChuHo || '',
        'Lý do/Trường hợp': formState.values.truongHop || '',
      }
    });

    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 5000);
  };

  const handleSaveDraft = () => {
    setSavedDraft(true);
    setTimeout(() => setSavedDraft(false), 3000);
  };

  const renderSectionContent = (section: SectionDef) => {
    if (section.id === 'co-quan') {
      return (
        <>
          {renderServiceFields(section.fieldIds)}
          {administrativeError && (
            <p className="form-error-msg" role="alert" style={{ marginTop: 10 }}>
              ⚠️ {administrativeError}
            </p>
          )}
        </>
      );
    }

    if (section.customContent === 'procedure') return renderProcedureSection();
    if (section.customContent === 'applicant') return renderApplicantSection();
    if (section.customContent === 'request') return renderRequestSection();
    if (section.customContent === 'upload') return renderUploadSection();
    if (section.customContent === 'notification') return renderNotificationSection();
    if (section.customContent === 'vneid') return renderVNeIDSection();

    const columnsClass = section.fieldIds.length <= 2 ? 'cols-2' : section.fieldIds.length === 3 ? 'cols-3' : '';
    return renderServiceFields(section.fieldIds, columnsClass);
  };

  return (
    <div className="main-content dktt-main-content animate-slide-up">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">
          <Home size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          Trang Chủ
        </Link>
        <ChevronRight size={13} className="breadcrumb-sep" />
        <span>Cư trú</span>
        <ChevronRight size={13} className="breadcrumb-sep" />
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
          Đăng ký thường trú
        </span>
      </nav>

      <div className="service-page dktt-service-page">
        <div className="dktt-form-shell">
          <div className="dktt-page-header" data-highlight-id="form-section">
            <h1>ĐĂNG KÝ THƯỜNG TRÚ</h1>
            <p>Cổng Dịch vụ Công — Bộ Công An</p>
          </div>

          <div className="dktt-ai-hint" data-highlight-id="ai-hint">
            <span className="dktt-ai-hint-icon">
              <img src="/logo_Gov_Bridge.jpg" alt="AI" />
            </span>
            <span>
              <strong>Mẹo:</strong> Nhấn vào nút Trợ lý AI (góc phải) để tự động điền
              form bằng <strong>giọng nói</strong> hoặc <strong>ảnh CCCD</strong>.
            </span>
          </div>

          <div className="dktt-required-note">
            <strong>Ghi chú:</strong> Các thông tin có dấu <span className="red">(*)</span> là thông tin bắt buộc phải nhập
          </div>
          <input
            ref={cccdInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="dktt-hidden-file-input"
            onChange={handleSectionCccdUpload}
          />

          {SECTIONS.map((section) => (
            <div
              key={section.id}
              className={`dktt-section${openSections[section.id] ? ' open' : ''}`}
              id={`section-${section.id}`}
            >
              <div
                className="dktt-section-header"
                onClick={() => toggleSection(section.id)}
                role="button"
                tabIndex={0}
                aria-expanded={openSections[section.id]}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleSection(section.id);
                  }
                }}
              >
                <div className="dktt-section-header-left">
                  <span className="dktt-section-number">{section.number}</span>
                  <h3 className="dktt-section-title">
                    {section.title}
                    {section.id === 'ho-so-dinh-kem' && <span className="dktt-section-required">(*)</span>}
                  </h3>
                </div>
                {section.id === 'nguoi-de-nghi' && (
                  <div className="dktt-section-header-action">
                    {renderCccdHeaderAction('applicant', 'Đọc CCCD cho người đề nghị')}
                  </div>
                )}
                <ChevronDown size={20} className="dktt-section-chevron" />
              </div>
              <div className="dktt-section-body">
                {renderSectionContent(section)}
              </div>
            </div>
          ))}

          <label className="dktt-legal-check">
            <input
              type="checkbox"
              checked={agreedLegal}
              onChange={(event) => setAgreedLegal(event.target.checked)}
            />
            <span>Tôi xin chịu trách nhiệm trước pháp luật về lời khai trên</span>
          </label>

          <div className="dktt-actions">
            <button className="btn btn-outline" onClick={() => navigate('/')}>
              <ArrowLeft size={16} />
              Quay lại
            </button>
            <button className="btn btn-secondary" onClick={handleSaveDraft}>
              <Save size={16} />
              Lưu nháp
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              id="submit-btn"
              data-highlight-id="submit-btn"
              data-highlight-label="Nút Nộp Hồ Sơ"
            >
              <Send size={16} />
              Nộp hồ sơ
            </button>
          </div>
        </div>

        <aside className="service-sidebar dktt-service-sidebar" aria-label="Thông tin dịch vụ">
          <div className="sidebar-info-card">
            <div className="sidebar-info-card-header">
              <div className="sidebar-info-card-title">Giấy tờ cần chuẩn bị</div>
            </div>
            <div className="sidebar-info-card-body">
              <ul className="info-list">
                {service.requiredDocs.map((doc, index) => (
                  <li key={index} className="info-list-item">{doc}</li>
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
      </div>

      {submitted && (
        <div className="dktt-toast" role="alert">
          ✅ Nộp hồ sơ thành công! Chúng tôi sẽ xem xét và phản hồi trong {service.processingTime}.
        </div>
      )}
      {savedDraft && (
        <div className="dktt-toast" style={{ background: 'var(--primary)' }} role="alert">
          💾 Đã lưu nháp hồ sơ thành công!
        </div>
      )}
      {toastMessage && (
        <div className="dktt-toast" style={{ background: 'var(--primary-dark)' }} role="alert">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default DangKyThuongTruPage;
