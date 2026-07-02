import React from 'react';
import { ArrowLeft, Calendar, ChevronUp, FileText, Home, Paperclip, Plus, Save, Send, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { provinces, getResidenceAgencyName, useWards } from '../../hooks/useAdministrativeUnits';
import { saveApplicationToDashboard, type DashboardDocument } from '../../utils/dashboardSync';
import { saveAttachmentFile } from '../../utils/attachmentStorage';

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
}

interface FamilyMember {
  id: number;
  hoTen: string;
  ngaySinh: string;
  gioiTinh: string;
  cccd: string;
  quanHe: string;
}

const genderOptions = ['Chưa có thông tin', 'Nam', 'Nữ', 'Khác'];
const ethnicityOptions = [
  'Kinh',
  'Tày',
  'Thái',
  'Mường',
  'Khmer',
  'Hoa',
  'Nùng',
  'H\'Mông',
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

const getResidenceAgencyOptions = (wardName: string): string[] => (
  wardName ? [getResidenceAgencyName(wardName)] : []
);

const getWardFieldPlaceholder = (provinceName: string, isLoading: boolean): string => {
  if (!provinceName) return 'Chọn tỉnh/thành phố trước';
  return isLoading ? 'Đang tải...' : 'Chọn';
};

const createAgencyFields = (
  wardOptions: string[],
  selectedProvince: string,
  selectedWard: string,
  isLoading: boolean,
): FieldConfig[] => [
  { id: 'provinceAgency', label: 'Tỉnh/ Thành phố', kind: 'select', required: true, placeholder: 'Chọn', options: provinces },
  { id: 'wardAgency', label: 'Xã/Phường/Đặc khu', kind: 'select', required: true, placeholder: getWardFieldPlaceholder(selectedProvince, isLoading), options: wardOptions },
  { id: 'residenceAgency', label: 'Cơ quan đăng ký cư trú', kind: 'select', required: true, placeholder: 'Chọn', options: getResidenceAgencyOptions(selectedWard) },
  { id: 'agencyPhone', label: 'Số điện thoại', kind: 'text', readOnly: true, placeholder: '0292 3894 939' },
];

const procedureFields: FieldConfig[] = [
  { id: 'procedure', label: 'Thủ tục', kind: 'select', required: true, placeholder: 'Thủ tục', options: procedureOptions, readOnly: true },
  { id: 'caseType', label: 'Trường hợp', kind: 'select', required: true, placeholder: 'Chọn', options: caseOptions },
];

const applicantFields: FieldConfig[] = [
  { id: 'fullName', label: 'Họ tên', kind: 'text', required: true },
  { id: 'birthType', label: 'Ngày sinh', kind: 'select', required: true, options: ['Ngày tháng năm', 'Tháng năm', 'Năm'], placeholder: 'Ngày tháng năm' },
  { id: 'birthDate', label: 'Ngày sinh', kind: 'text', required: true, placeholder: 'Chọn thời gian' },
  { id: 'gender', label: 'Giới tính', kind: 'select', required: true, placeholder: 'Chọn', options: genderOptions },
  { id: 'ethnicity', label: 'Dân tộc', kind: 'select', required: true, placeholder: 'Dân tộc', options: ethnicityOptions },
  { id: 'citizenId', label: 'Số ĐDCN (CCCD)', kind: 'text', required: true },
  { id: 'phone', label: 'SĐT liên hệ', kind: 'text' },
  { id: 'email', label: 'Email', kind: 'text' },
];

const createRequestFields = (
  wardOptions: string[],
  selectedProvince: string,
  isLoading: boolean,
): FieldConfig[] => [
  { id: 'requestProvince', label: 'Tỉnh/ Thành phố', kind: 'select', required: true, placeholder: 'Chọn', options: provinces },
  { id: 'requestWard', label: 'Xã/Phường/Đặc khu', kind: 'select', required: true, placeholder: getWardFieldPlaceholder(selectedProvince, isLoading), options: wardOptions },
  { id: 'address', label: 'Địa chỉ (số nhà, đường phố, thôn, xóm, làng, ấp, bản, buôn, phum, sóc)', kind: 'text', required: true, placeholder: 'Địa chỉ nơi cư trú hiện tại của công dân', span: 2 },
  { id: 'requestContent', label: 'Nội dung đề nghị', kind: 'textarea', required: true, span: 2, readOnly: true },
];

const initialValues: Record<string, string> = {
  birthType: 'Ngày tháng năm',
  procedure: 'Xác nhận thông tin về cư trú',
  notificationMethod: 'Nhận qua cổng thông tin',
  resultMethod: 'Nhận qua cổng thông tin',
};

const XacNhanCuTruPage: React.FC = () => {
  const navigate = useNavigate();
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
  const [pledged, setPledged] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [draftSaved, setDraftSaved] = React.useState(false);
  const { wardOptions: agencyWardOptions, loading: loadingAgencyWards } = useWards(values.provinceAgency);
  const { wardOptions: requestWardOptions, loading: loadingRequestWards } = useWards(values.requestProvince);

  const agencyFields = React.useMemo(
    () => createAgencyFields(agencyWardOptions, values.provinceAgency || '', values.wardAgency || '', loadingAgencyWards),
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
        nextValues = { ...nextValues, wardAgency: value, residenceAgency: value ? getResidenceAgencyName(value) : '' };
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

  const toggleSection = (sectionId: string) => {
    setOpenSections((current) => ({ ...current, [sectionId]: !current[sectionId] }));
  };

  const updateMember = (id: number, key: keyof Omit<FamilyMember, 'id'>, value: string) => {
    setMembers((current) => current.map((member) => (member.id === id ? { ...member, [key]: value } : member)));
    setErrors((current) => ({ ...current, [`member-${id}-${key}`]: '' }));
  };

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
        const hasAnyValue = (['hoTen', 'ngaySinh', 'gioiTinh', 'cccd', 'quanHe'] as const)
          .some((key) => !!String(member[key] || '').trim());
        
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
    
    let attachments = [];
    if (uploadedFile) {
        const metadata = await saveAttachmentFile(uploadedFile);
        attachments.push(metadata);
    }

    const documents: DashboardDocument[] = uploadedFile
      ? [{ name: uploadedFile.name, state: 'Đã có' }]
      : [{ name: 'Chưa tải file đính kèm', state: 'Cần kiểm tra' }];

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
        <span>Trang chủ</span>
        <span>/</span>
        <strong>Hồ sơ Xác nhận thông tin về cư trú</strong>
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
          <strong>Mẹo:</strong> Nhấn vào nút Trợ lý AI (góc phải) để tự động điền
          form bằng <strong>giọng nói</strong> hoặc <strong>ảnh CCCD</strong>.
        </span>
      </div>

      <p className="dktt-required-note xctt-note">
        <strong>Ghi chú:</strong> Các thông tin có dấu <span className="red">(*)</span> là thông tin bắt buộc phải nhập
      </p>

      <XcttSection id="agency" title="CƠ QUAN THỰC HIỆN" open={openSections.agency} onToggle={toggleSection}>
        <FieldGrid fields={agencyFields} values={values} errors={errors} onChange={setFieldValue} />
      </XcttSection>

      <XcttSection id="procedure" title="THỦ TỤC HÀNH CHÍNH YÊU CẦU" open={openSections.procedure} onToggle={toggleSection}>
        <FieldGrid fields={procedureFields} values={values} errors={errors} onChange={setFieldValue} />
      </XcttSection>

      <XcttSection id="applicant" title="THÔNG TIN NGƯỜI XÁC NHẬN THÔNG TIN VỀ CƯ TRÚ" open={openSections.applicant} onToggle={toggleSection}>
        <div className="xctt-radio-stack">
          <label>
            <input type="radio" checked={declareMode === 'self'} onChange={() => setDeclareMode('self')} />
            Người khai thông tin là người Xác nhận thông tin về cư trú (tự động điền các thông tin của chủ tài khoản được lấy từ dữ liệu dân cư)
          </label>
          <label>
            <input type="radio" checked={declareMode === 'proxy'} onChange={() => setDeclareMode('proxy')} />
            Khai hộ (yêu cầu khai đúng các trường thông tin có trong cơ sở dữ liệu quốc gia về dân cư của người được khai hộ)
          </label>
        </div>
        <ApplicantFieldGrid fields={applicantFields} values={values} errors={errors} onChange={setFieldValue} />
        <FamilyMemberTable members={members} errors={errors} onAdd={() => setMembers((current) => [...current, createMember(current.length + 1)])} onChange={updateMember} />
      </XcttSection>

      <XcttSection id="request" title="THÔNG TIN ĐỀ NGHỊ" open={openSections.request} onToggle={toggleSection}>
        <h3 className="xctt-subtitle">Nơi đề nghị đăng ký thường trú <span>(*)</span></h3>
        <FieldGrid fields={requestFields} values={values} errors={errors} onChange={setFieldValue} />
      </XcttSection>

      <XcttSection id="attachment" title="TRƯỜNG HỢP VÀ HỒ SƠ ĐÍNH KÈM(*)" open={openSections.attachment} onToggle={toggleSection}>
        <p className="xctt-upload-intro">Vui lòng chọn trường hợp và đính kèm các tập tin hình ảnh về các loại giấy tờ sau để giúp cơ quan chức năng xác minh và giải quyết hồ sơ của ông/bà</p>
        <div className="xctt-attachment-row">
          <FileText size={20} />
          <span>Giấy tờ, tài liệu chứng minh thông tin cư trú cần xác nhận</span>
          <label className="xctt-upload-btn">
            <Paperclip size={18} />
            Chọn tệp tin
            <input type="file" onChange={(event) => setUploadedFile(event.target.files?.[0] || null)} />
          </label>
          {uploadedFile && <strong>{uploadedFile.name}</strong>}
        </div>
      </XcttSection>

      <XcttSection id="notification" title="THÔNG TIN NHẬN THÔNG BÁO TÌNH TRẠNG HỒ SƠ, KẾT QUẢ GIẢI QUYẾT HỒ SƠ" open={openSections.notification} onToggle={toggleSection}>
        <div className="xctt-notification-fields">
          <MockTagSelect label="Hình thức nhận thông báo" value={values.notificationMethod || notificationReceiveOptions[1]} onClear={() => setFieldValue('notificationMethod', '')} />
          <FieldControl field={{ id: 'resultMethod', label: 'Hình thức nhận kết quả', kind: 'select', options: resultReceiveOptions }} value={values.resultMethod || resultReceiveOptions[2]} error={errors.resultMethod} onChange={(value) => setFieldValue('resultMethod', value)} />
        </div>
      </XcttSection>

      <label className="xctt-pledge">
        <input type="checkbox" checked={pledged} onChange={(event) => { setPledged(event.target.checked); setErrors((current) => ({ ...current, pledge: '' })); }} />
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

      {showSuccess && (
        <div className="xctt-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="xctt-success-title">
          <div className="xctt-modal">
            <button type="button" className="xctt-modal-close" aria-label="Đóng" onClick={() => setShowSuccess(false)}>
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
  title: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}

const XcttSection: React.FC<SectionProps> = ({ id, title, open, onToggle, children }) => (
  <section className={`xctt-section xctt-section-${id} ${open ? 'open' : ''}`}>
    <button type="button" className="xctt-section-header" onClick={() => onToggle(id)} aria-expanded={open}>
      <span>{title}</span>
      <ChevronUp size={24} />
    </button>
    {open && <div className="xctt-section-body">{children}</div>}
  </section>
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
      <FieldControl key={field.id} field={field} value={values[field.id] || ''} error={errors[field.id]} onChange={(value) => onChange(field.id, value)} />
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
          <FieldControl field={field} value={values[field.id] || ''} error={errors[field.id]} onChange={(value) => onChange(field.id, value)} />
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
            <option value={option} key={option}>{option}</option>
          ))}
        </select>
      </div>
      <div className="xctt-date-input-shell">
        <input
          id={birthDateField.id}
          type={values[birthTypeField.id] === 'Năm' ? 'number' : values[birthTypeField.id] === 'Tháng năm' ? 'month' : 'date'}
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
        <select id={field.id} value={value} onChange={(event) => onChange(event.target.value)} disabled={field.readOnly}>
          <option value="">{field.placeholder || 'Chọn'}</option>
          {(field.options || []).map((option) => (
            <option value={option} key={option}>{option}</option>
          ))}
        </select>
        {value && !field.readOnly && (
          <button type="button" className="xctt-select-clear" aria-label={`Xóa ${field.label}`} onClick={() => onChange('')}>
            <X size={16} />
          </button>
        )}
      </div>
    ) : field.kind === 'textarea' ? (
      <textarea id={field.id} value={value} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} readOnly={field.readOnly} />
    ) : (
      <input id={field.id} type={field.kind} value={field.readOnly ? field.placeholder || value : value} placeholder={field.placeholder} readOnly={field.readOnly} onChange={(event) => onChange(event.target.value)} />
    )}
    {error && <p className="xctt-error">{error}</p>}
  </div>
);

const FamilyMemberTable: React.FC<{
  members: FamilyMember[];
  errors: Record<string, string>;
  onAdd: () => void;
  onChange: (id: number, key: keyof Omit<FamilyMember, 'id'>, value: string) => void;
}> = ({ members, errors, onAdd, onChange }) => (
  <div className="xctt-family">
    <h3>Những thành viên trong hộ gia đình cùng thay đổi (Không bắt buộc)</h3>
    <div className="xctt-family-table-wrap">
      <table className="xctt-family-table">
        <colgroup>
          <col className="xctt-family-col-action" />
          <col className="xctt-family-col-index" />
          <col className="xctt-family-col-name" />
          <col className="xctt-family-col-birth" />
          <col className="xctt-family-col-gender" />
          <col className="xctt-family-col-id" />
          <col className="xctt-family-col-relation" />
        </colgroup>
        <thead>
          <tr>
            <th>Thao tác</th>
            <th>STT</th>
            <th>Họ và tên</th>
            <th>Ngày sinh</th>
            <th>Giới tính</th>
            <th>Số ĐDCN (CCCD)</th>
            <th>Quan hệ với chủ hộ</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member, index) => (
            <tr key={member.id}>
              <td>
                {index === 0 && (
                  <button type="button" className="xctt-add-row" onClick={onAdd} aria-label="Thêm thành viên">
                    <Plus size={22} />
                  </button>
                )}
              </td>
              <td>{index + 1}</td>
              <td><TableInput value={member.hoTen} error={errors[`member-${member.id}-hoTen`]} onChange={(value) => onChange(member.id, 'hoTen', value)} /></td>
              <td><TableInput type="date" value={member.ngaySinh} error={errors[`member-${member.id}-ngaySinh`]} onChange={(value) => onChange(member.id, 'ngaySinh', value)} /></td>
              <td><TableSelect value={member.gioiTinh} options={genderOptions} error={errors[`member-${member.id}-gioiTinh`]} onChange={(value) => onChange(member.id, 'gioiTinh', value)} /></td>
              <td><TableInput value={member.cccd} error={errors[`member-${member.id}-cccd`]} onChange={(value) => onChange(member.id, 'cccd', value)} /></td>
              <td><TableSelect value={member.quanHe} options={relationOptions} error={errors[`member-${member.id}-quanHe`]} onChange={(value) => onChange(member.id, 'quanHe', value)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const TableInput: React.FC<{ type?: string; value: string; error?: string; onChange: (value: string) => void }> = ({ type = 'text', value, error, onChange }) => (
  <div className="xctt-table-control">
    <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    {error && <small className="xctt-error">{error}</small>}
  </div>
);

const TableSelect: React.FC<{ value: string; options: string[]; error?: string; onChange: (value: string) => void }> = ({ value, options, error, onChange }) => (
  <div className="xctt-table-control">
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Chọn</option>
      {options.map((option) => (
        <option value={option} key={option}>{option}</option>
      ))}
    </select>
    {error && <small className="xctt-error">{error}</small>}
  </div>
);

const MockTagSelect: React.FC<{ label: string; value: string; onClear: () => void }> = ({ label, value, onClear }) => (
  <div className="xctt-field span-2">
    <label>{label}</label>
    <div className="xctt-tag-select">
      <span><button type="button" onClick={onClear}>×</button>{value}</span>
      <button type="button" onClick={onClear} aria-label="Xóa lựa chọn">×</button>
    </div>
  </div>
);

export default XacNhanCuTruPage;
