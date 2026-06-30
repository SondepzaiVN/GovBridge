import React from 'react';
import { ArrowLeft, ChevronUp, FileText, Home, Paperclip, Plus, Save, Send, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

const provinces = ['Thành phố Hà Nội', 'Thành phố Cần Thơ', 'Thành phố Hồ Chí Minh', 'Thành phố Đà Nẵng'];
const wards = ['Phường Cái Khế', 'Phường An Khánh', 'Phường Cửa Nam', 'Phường Bến Nghé'];
const genderOptions = ['Nam', 'Nữ', 'Khác'];
const procedureOptions = [
  'Đăng ký thường trú lập hộ mới',
  'Đăng ký thường trú vào hộ đã có',
  'CD Việt Nam định cư ở nước ngoài không có hộ chiếu Việt Nam còn giá trị sử dụng',
];
const caseOptions = [
  'Xác nhận thông tin về cư trú',
  'Xác nhận thông tin hộ gia đình',
  'Xác nhận nơi thường trú',
  'Xác nhận nơi tạm trú',
];
const relationOptions = ['Chủ hộ', 'Vợ', 'Chồng', 'Con', 'Cha', 'Mẹ', 'Người thân khác'];
const receiveOptions = ['Nhận qua cổng thông tin', 'Nhận trực tiếp tại cơ quan giải quyết'];

const createMember = (id: number): FamilyMember => ({
  id,
  hoTen: '',
  ngaySinh: '',
  gioiTinh: '',
  cccd: '',
  quanHe: '',
});

const agencyFields: FieldConfig[] = [
  { id: 'provinceAgency', label: 'Tỉnh/ Thành phố', kind: 'select', required: true, placeholder: 'Chọn', options: provinces },
  { id: 'wardAgency', label: 'Xã/Phường/Đặc khu', kind: 'select', required: true, placeholder: 'Chọn', options: wards },
  { id: 'residenceAgency', label: 'Cơ quan đăng ký cư trú', kind: 'select', required: true, options: ['Công an Phường Cái Khế', 'Công an Phường An Khánh', 'Công an Phường Cửa Nam'] },
  { id: 'agencyPhone', label: 'Số điện thoại', kind: 'text', readOnly: true, placeholder: '0292 3894 939' },
];

const procedureFields: FieldConfig[] = [
  { id: 'procedure', label: 'Thủ tục', kind: 'select', required: true, placeholder: 'Thủ tục', options: procedureOptions },
  { id: 'caseType', label: 'Trường hợp', kind: 'select', required: true, placeholder: 'Trường hợp', options: caseOptions },
];

const applicantFields: FieldConfig[] = [
  { id: 'fullName', label: 'Họ tên', kind: 'text', required: true },
  { id: 'birthType', label: 'Ngày sinh', kind: 'select', required: true, options: ['Ngày tháng năm', 'Tháng năm', 'Năm'], placeholder: 'Ngày tháng năm' },
  { id: 'birthDate', label: 'Chọn thời gian', kind: 'date', required: true },
  { id: 'gender', label: 'Giới tính', kind: 'select', required: true, placeholder: 'Chọn', options: genderOptions },
  { id: 'citizenId', label: 'Số ĐDCN (CCCD)', kind: 'text', required: true },
  { id: 'phone', label: 'SĐT liên hệ', kind: 'text' },
  { id: 'email', label: 'Email', kind: 'text' },
];

const requestFields: FieldConfig[] = [
  { id: 'requestProvince', label: 'Tỉnh/ Thành phố', kind: 'select', required: true, placeholder: 'Chọn', options: provinces },
  { id: 'requestWard', label: 'Xã/Phường/Đặc khu', kind: 'select', required: true, placeholder: 'Chọn', options: wards },
  { id: 'address', label: 'Địa chỉ (số nhà, đường phố, thôn, xóm, làng, ấp, bản, buôn, phum, sóc)', kind: 'text', required: true, placeholder: 'Địa chỉ nơi cư trú hiện tại của công dân', span: 2 },
  { id: 'requestContent', label: 'Nội dung đề nghị', kind: 'textarea', required: true, span: 2 },
];

const initialValues: Record<string, string> = {
  birthType: 'Ngày tháng năm',
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
  const [uploadedFile, setUploadedFile] = React.useState('');
  const [pledged, setPledged] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [draftSaved, setDraftSaved] = React.useState(false);

  const setFieldValue = (fieldId: string, value: string) => {
    setValues((current) => ({ ...current, [fieldId]: value }));
    setErrors((current) => ({ ...current, [fieldId]: '' }));
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
        (['hoTen', 'ngaySinh', 'gioiTinh', 'cccd', 'quanHe'] as const).forEach((key) => {
          if (!String(member[key] || '').trim()) {
            nextErrors[`member-${member.id}-${key}`] = 'Bắt buộc';
          }
        });
      });
    }

    if (!pledged) nextErrors.pledge = 'Vui lòng xác nhận cam kết trước khi nộp hồ sơ.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = () => {
    setDraftSaved(false);
    if (!validate()) return;
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

      <p className="xctt-note">
        <strong>Ghi chú:</strong> Các thông tin có dấu <span>(*)</span> là thông tin bắt buộc phải nhập
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
        <FieldGrid fields={applicantFields} values={values} errors={errors} onChange={setFieldValue} columns={4} />
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
            <input type="file" onChange={(event) => setUploadedFile(event.target.files?.[0]?.name || '')} />
          </label>
          {uploadedFile && <strong>{uploadedFile}</strong>}
        </div>
      </XcttSection>

      <XcttSection id="notification" title="THÔNG TIN NHẬN THÔNG BÁO TÌNH TRẠNG HỒ SƠ, KẾT QUẢ GIẢI QUYẾT HỒ SƠ" open={openSections.notification} onToggle={toggleSection}>
        <div className="xctt-notification-fields">
          <MockTagSelect label="Hình thức nhận thông báo" value={values.notificationMethod || receiveOptions[0]} onClear={() => setFieldValue('notificationMethod', '')} />
          <FieldControl field={{ id: 'resultMethod', label: 'Hình thức nhận kết quả', kind: 'select', options: receiveOptions }} value={values.resultMethod || receiveOptions[0]} error={errors.resultMethod} onChange={(value) => setFieldValue('resultMethod', value)} />
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
  <section className={`xctt-section ${open ? 'open' : ''}`}>
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
      <select id={field.id} value={value} onChange={(event) => onChange(event.target.value)} disabled={field.readOnly}>
        <option value="">{field.placeholder || 'Chọn'}</option>
        {(field.options || []).map((option) => (
          <option value={option} key={option}>{option}</option>
        ))}
      </select>
    ) : field.kind === 'textarea' ? (
      <textarea id={field.id} value={value} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
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
    <h3>Những thành viên trong hộ gia đình cùng thay đổi</h3>
    <div className="xctt-family-table-wrap">
      <table className="xctt-family-table">
        <thead>
          <tr>
            <th>Thao tác</th>
            <th>STT</th>
            <th>Họ và tên <span>(*)</span></th>
            <th>Ngày sinh <span>(*)</span></th>
            <th>Giới tính <span>(*)</span></th>
            <th>Số ĐDCN (CCCD) <span>(*)</span></th>
            <th>Quan hệ với chủ hộ <span>(*)</span></th>
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
  <div>
    <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    {error && <small className="xctt-error">{error}</small>}
  </div>
);

const TableSelect: React.FC<{ value: string; options: string[]; error?: string; onChange: (value: string) => void }> = ({ value, options, error, onChange }) => (
  <div>
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
