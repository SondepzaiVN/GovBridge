import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown, Home, Send, Save, ArrowLeft, Upload } from 'lucide-react';
import { SERVICE_MAP } from '../../data/services';
import { useForm } from '../../contexts/FormContext';
import { FormFieldInput } from './ServicePageLayout';
import type { FormField } from '../../types';
import { administrativeUnitService } from '../../api/administrativeUnitService';

const FIXED_RESIDENCE_AGENCY_VALUE = 'ca_phuong';
const FIXED_RESIDENCE_AGENCY_PHONE = '0292 3894 939';

const toResidenceAgencyLabel = (wardName: string) => (
  wardName
    ? `Công an ${wardName.charAt(0).toLocaleLowerCase('vi-VN')}${wardName.slice(1)}`
    : ''
);

// ============================================================
// Section definitions matching the original DVC form
// ============================================================
interface SectionDef {
  id: string;
  number: number;
  title: string;
  fieldIds: string[];
  customContent?: 'upload' | 'vneid';
}

interface FamilyMember {
  id: number;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  citizenId: string;
  occupation: string;
  workplace: string;
  relationshipWithHouseholder: string;
}

const GENDER_OPTIONS = ['Nam', 'Nữ', 'Khác'];

const OCCUPATION_OPTIONS = [
  'Tự do', 'Học sinh/Sinh viên', 'Công nhân',
  'Nhân viên văn phòng', 'Kinh doanh', 'Không có', 'Khác',
];

const RELATIONSHIP_OPTIONS = [
  'Chủ hộ', 'Vợ', 'Chồng', 'Con đẻ', 'Con nuôi',
  'Cha', 'Mẹ', 'Ông', 'Bà', 'Anh', 'Chị', 'Em',
  'Cháu ruột', 'Người ở nhờ', 'Khác',
];

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
    fieldIds: ['thuTuc', 'loaiDKTT', 'truongHop'],
  },
  {
    id: 'nguoi-de-nghi',
    number: 3,
    title: 'Thông tin người đề nghị đăng ký thường trú',
    fieldIds: ['hoTen', 'ngaySinh', 'gioiTinh', 'danToc', 'tonGiao', 'cccd', 'sdt', 'email'],
  },
  {
    id: 'thong-tin-de-nghi',
    number: 4,
    title: 'Thông tin đề nghị',
    fieldIds: ['tinhThanhDN', 'xaPhuongDN', 'diaChiDN', 'noiDungDN'],
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
  },
  {
    id: 'vneid',
    number: 7,
    title: 'Thông tin xác nhận tờ khai thông tin cư trú bản điện tử',
    fieldIds: [],
    customContent: 'vneid',
  },
];

// ============================================================
// Component
// ============================================================
const DangKyThuongTruPage: React.FC = () => {
  const service = SERVICE_MAP['ho-khau'];
  const { formState, setFieldValue, fillFields } = useForm();
  const navigate = useNavigate();
  const selectedProvince = formState.values.tinhThanhCQ || '';
  const selectedWard = formState.values.xaPhuongCQ || '';
  const [provinceOptions, setProvinceOptions] = useState<FormField['options']>([]);
  const [wardOptions, setWardOptions] = useState<FormField['options']>([]);
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(true);
  const [isLoadingWards, setIsLoadingWards] = useState(Boolean(selectedProvince));
  const [administrativeError, setAdministrativeError] = useState('');

  // Accordion state — first 4 sections open by default
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    SECTIONS.forEach((s) => {
      init[s.id] = s.number <= 4;
    });
    return init;
  });

  const [agreedLegal, setAgreedLegal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);
  const [declareSelf, setDeclareSelf] = useState<'self' | 'proxy'>('proxy');

  // ── Family members table state ──
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([{
    id: 1, fullName: '', dateOfBirth: '', gender: '', citizenId: '',
    occupation: '', workplace: '', relationshipWithHouseholder: '',
  }]);
  const [memberCounter, setMemberCounter] = useState(2);

  const addFamilyMember = () => {
    setFamilyMembers(prev => [...prev, {
      id: memberCounter, fullName: '', dateOfBirth: '', gender: '', citizenId: '',
      occupation: '', workplace: '', relationshipWithHouseholder: '',
    }]);
    setMemberCounter(prev => prev + 1);
  };

  const removeFamilyMember = (id: number) => {
    setFamilyMembers(prev => prev.filter(m => m.id !== id));
  };

  const updateFamilyMember = (
    id: number,
    field: keyof Omit<FamilyMember, 'id'>,
    value: string,
  ) => {
    setFamilyMembers(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
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
        setAdministrativeError('Không tải được danh sách tỉnh/thành phố. Vui lòng tải lại trang.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingProvinces(false);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedProvince) return;

    const controller = new AbortController();

    administrativeUnitService.getWards(selectedProvince, controller.signal)
      .then((options) => {
        setWardOptions(options);
        setAdministrativeError('');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setWardOptions([]);
        setAdministrativeError('Không tải được danh sách xã/phường/đặc khu của địa phương đã chọn.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingWards(false);
      });

    return () => controller.abort();
  }, [selectedProvince]);

  useEffect(() => {
    if (selectedProvince && selectedWard) {
      if (
        formState.values.coQuanDKCT !== FIXED_RESIDENCE_AGENCY_VALUE
        || formState.values.sdtCoQuan !== FIXED_RESIDENCE_AGENCY_PHONE
      ) {
        fillFields({
          coQuanDKCT: FIXED_RESIDENCE_AGENCY_VALUE,
          sdtCoQuan: FIXED_RESIDENCE_AGENCY_PHONE,
        });
      }
      return;
    }

    if (formState.values.coQuanDKCT) setFieldValue('coQuanDKCT', '');
    if (formState.values.sdtCoQuan) setFieldValue('sdtCoQuan', '');
  }, [
    selectedProvince,
    selectedWard,
    formState.values.coQuanDKCT,
    formState.values.sdtCoQuan,
    fillFields,
    setFieldValue,
  ]);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getFieldValue = (fieldId: string) => formState.values[fieldId] || '';
  const isAutofilled = (fieldId: string) =>
    !!formState.touched[fieldId] && !!formState.values[fieldId];

  // Build a lookup from field id to FormField
  const fieldMap = useMemo(() => {
    const map = new Map<string, FormField>();
    const selectedWardName = wardOptions?.find((option) => option.value === selectedWard)?.label || '';

    service.fields.forEach((field) => {
      if (field.id === 'tinhThanhCQ') {
        map.set(field.id, { ...field, options: provinceOptions });
        return;
      }

      if (field.id === 'xaPhuongCQ') {
        map.set(field.id, { ...field, options: wardOptions });
        return;
      }

      if (field.id === 'coQuanDKCT') {
        map.set(field.id, {
          ...field,
          options: [{
            value: FIXED_RESIDENCE_AGENCY_VALUE,
            label: toResidenceAgencyLabel(selectedWardName),
          }],
        });
        return;
      }

      map.set(field.id, field);
    });

    return map;
  }, [service.fields, provinceOptions, selectedWard, wardOptions]);

  const handleFieldChange = (fieldId: string, value: string) => {
    if (fieldId === 'tinhThanhCQ') {
      setFieldValue('tinhThanhCQ', value);
      setFieldValue('xaPhuongCQ', '');
      setFieldValue('coQuanDKCT', '');
      setFieldValue('sdtCoQuan', '');
      setWardOptions([]);
      setIsLoadingWards(Boolean(value));
      return;
    }

    setFieldValue(fieldId, value);
  };

  const isFieldDisabled = (fieldId: string) => {
    if (fieldId === 'tinhThanhCQ') return isLoadingProvinces;
    if (fieldId === 'xaPhuongCQ') return !selectedProvince || isLoadingWards;
    return fieldId === 'coQuanDKCT' || fieldId === 'sdtCoQuan';
  };

  const handleSubmit = () => {
    if (!agreedLegal) {
      alert('Vui lòng xác nhận chịu trách nhiệm trước pháp luật về lời khai trên.');
      return;
    }
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 5000);
  };

  const handleSaveDraft = () => {
    setSavedDraft(true);
    setTimeout(() => setSavedDraft(false), 3000);
  };

  // Render fields for a section
  const renderFields = (fieldIds: string[], columnsClass = '') => {
    const fields = fieldIds.map((id) => fieldMap.get(id)).filter(Boolean) as FormField[];
    if (fields.length === 0) return null;

    return (
      <div className={`dktt-form-row ${columnsClass}`}>
        {fields.map((field) => (
          <FormFieldInput
            key={field.id}
            field={field}
            value={getFieldValue(field.id)}
            onChange={(val) => handleFieldChange(field.id, val)}
            isAutofilled={isAutofilled(field.id)}
            disabled={isFieldDisabled(field.id)}
          />
        ))}
      </div>
    );
  };

  // Render custom upload section
  const renderUploadSection = () => (
    <div>
      <p className="dktt-note">
        Vui lòng chọn trường hợp và đính kèm các tập tin hình ảnh về các loại giấy tờ sau
        để giúp cơ quan chức năng xác minh và giải quyết hồ sơ của ông/bà
      </p>

      {/* CT01 Upload */}
      <div className="dktt-sub-title">Tờ khai thay đổi thông tin cư trú (CT01)</div>
      <div className="dktt-upload-area">
        <input type="file" accept="image/png, image/jpeg, application/pdf" multiple />
        <div className="dktt-upload-icon">
          <Upload size={32} strokeWidth={1.5} />
        </div>
        <div className="dktt-upload-text">
          <strong>Nhấn để chọn file</strong> hoặc kéo thả file vào đây
          <br />
          Hỗ trợ: JPG, PNG, PDF (tối đa 10MB)
        </div>
      </div>

      {/* Giấy tờ chứng minh chỗ ở */}
      <div className="dktt-sub-title" style={{ marginTop: 24 }}>
        Giấy tờ chứng minh chỗ ở hợp pháp
      </div>
      <div className="dktt-upload-area">
        <input type="file" accept="image/png, image/jpeg, application/pdf" multiple />
        <div className="dktt-upload-icon">
          <Upload size={32} strokeWidth={1.5} />
        </div>
        <div className="dktt-upload-text">
          <strong>Nhấn để chọn file</strong> hoặc kéo thả file vào đây
          <br />
          Sổ đỏ, hợp đồng mua bán, hợp đồng thuê nhà...
        </div>
      </div>

      {/* Văn bản đồng ý chủ hộ */}
      <div className="dktt-sub-title" style={{ marginTop: 24 }}>
        Văn bản đồng ý của chủ hộ / chủ sở hữu chỗ ở hợp pháp (nếu có)
      </div>
      <div className="dktt-upload-area">
        <input type="file" accept="image/png, image/jpeg, application/pdf" multiple />
        <div className="dktt-upload-icon">
          <Upload size={32} strokeWidth={1.5} />
        </div>
        <div className="dktt-upload-text">
          <strong>Nhấn để chọn file</strong> hoặc kéo thả file vào đây
          <br />
          Văn bản có chữ ký của chủ hộ đồng ý cho đăng ký thường trú
        </div>
      </div>
    </div>
  );

  // Render VNeID section
  const renderVNeIDSection = () => (
    <div>
      <div className="dktt-vneid-box">
        <em>
          Công dân kê khai các thông tin sau nếu cần lấy ý kiến đồng ý của chủ hộ;
          chủ sở hữu chỗ ở hợp pháp; cha, mẹ, người giám hộ qua ứng dụng định danh
          điện tử (VNeID) và không bắt buộc đính kèm Tờ khai thay đổi thông tin cư trú
          (CT01, CT02) có chữ ký của người đã xin ý kiến xác nhận qua VNeID.
        </em>
      </div>

      <div className="dktt-form-row cols-2">
        <div className="form-group">
          <label className="form-label">Trạng thái xác nhận</label>
          <input
            className="form-input"
            type="text"
            value="Chưa gửi"
            disabled
            style={{ background: 'var(--gray-50)' }}
          />
        </div>
      </div>

      <div className="dktt-sub-title">Người kê khai là:</div>
      <div className="dktt-form-row cols-3">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8375rem', cursor: 'pointer' }}>
          <input type="checkbox" style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
          Chủ hộ
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8375rem', cursor: 'pointer' }}>
          <input type="checkbox" style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
          Chủ sở hữu chỗ ở hợp pháp
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8375rem', cursor: 'pointer' }}>
          <input type="checkbox" style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
          Cha/Mẹ/Người giám hộ
        </label>
      </div>

      <div className="dktt-sub-title" style={{ marginTop: 20 }}>Danh sách người cần xin ý kiến:</div>
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '24px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.8375rem',
        background: 'var(--gray-50)',
      }}>
        Chưa có dữ liệu. Vui lòng thêm thông tin người cần xin ý kiến.
      </div>

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <em style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          *Vui lòng kiểm tra tính chính xác của tài khoản định danh điện tử đã cung cấp
        </em>
        <br />
        <button
          className="btn"
          style={{
            marginTop: 8,
            padding: '10px 20px',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: '0.8375rem',
            cursor: 'pointer',
          }}
        >
          Kiểm tra tài khoản VNeID
        </button>
      </div>
    </div>
  );

  const renderSectionContent = (section: SectionDef) => {
    // Section 3: Thông tin người đề nghị — radio + fields + family table
    if (section.id === 'nguoi-de-nghi') {
      return (
        <div>
          {/* Radio: declare self or proxy */}
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12,
              cursor: 'pointer', fontSize: '0.8375rem', lineHeight: 1.5,
            }}>
              <input
                type="radio"
                name="declareSelf"
                checked={declareSelf === 'self'}
                onChange={() => setDeclareSelf('self')}
                style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--primary)' }}
              />
              <span>
                Người khai thông tin là người đăng ký thường trú
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.775rem' }}>
                  (tự động điền các thông tin của chủ tài khoản được lấy từ dữ liệu dân cư)
                </span>
              </span>
            </label>
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              cursor: 'pointer', fontSize: '0.8375rem', lineHeight: 1.5,
            }}>
              <input
                type="radio"
                name="declareSelf"
                checked={declareSelf === 'proxy'}
                onChange={() => setDeclareSelf('proxy')}
                style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--primary)' }}
              />
              <span>
                Khai hộ
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.775rem' }}>
                  (yêu cầu khai đúng các trường thông tin có trong cơ sở dữ liệu quốc gia về dân cư của người được khai hộ)
                </span>
              </span>
            </label>
          </div>

          {/* Main applicant fields */}
          <div style={{ flex: '1 1 0', minWidth: 300 }}>
            {renderFields(['hoTen', 'ngaySinh', 'gioiTinh'], 'cols-3')}
            {renderFields(['danToc', 'tonGiao'], 'cols-2')}
            {renderFields(['cccd', 'sdt', 'email'], 'cols-3')}
          </div>

          {/* ── Family members table (conditional by truongHop) ── */}
          {(() => {
            // ca_ho / lan_dau / nhan_khau thuộc field 'truongHop'
            const truongHop = formState.values.truongHop || '';

            // lan_dau = chỉ cần thông tin người đăng ký, ẩn bảng
            if (truongHop === 'lan_dau') return null;

            const isCaHo = truongHop === 'ca_ho';
            const isNhanKhau = truongHop === 'nhan_khau';
            // Hiển thị khi: ca_ho, nhan_khau, hoặc chưa chọn (mặc định)
            const showTable = isCaHo || isNhanKhau || truongHop === '';
            if (!showTable) return null;

            const tableTitle = isNhanKhau
              ? 'Danh sách nhân khẩu được đăng ký thêm / chuyển vào'
              : 'Những thành viên trong hộ gia đình cùng thay đổi';

            const badgeText = isCaHo
              ? '✱ Bắt buộc khi đăng ký cả hộ'
              : isNhanKhau
              ? 'ℹ️ Tùy chọn — thêm người cùng chuyển vào'
              : null;

            const badgeColor = isCaHo ? '#8B1A1A' : '#1a56a0';
            const badgeBg = isCaHo ? '#fff0f0' : '#eef3fa';

            return (
          <div style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div className="dktt-sub-title" style={{ margin: 0, borderBottom: 'none', flex: 1 }}>{tableTitle}</div>
              {badgeText && (
                <span style={{
                  fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)', background: badgeBg,
                  color: badgeColor, border: `1px solid ${badgeColor}40`,
                  whiteSpace: 'nowrap',
                }}>{badgeText}</span>
              )}
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
                    <th>Nghề nghiệp</th>
                    <th>Nơi làm việc</th>
                    <th>Quan hệ với chủ hộ <span className="req">(*)</span></th>
                  </tr>
                </thead>
                <tbody>
                  {familyMembers.map((member, index) => (
                    <tr key={member.id}>
                      {/* Thao tác */}
                      <td className="col-action">
                        {index === 0 ? (
                          <button
                            type="button"
                            className="dktt-btn-add"
                            onClick={addFamilyMember}
                            title="Thêm thành viên"
                          >+</button>
                        ) : (
                          <button
                            type="button"
                            className="dktt-btn-remove"
                            onClick={() => removeFamilyMember(member.id)}
                            title="Xóa dòng này"
                          >✕</button>
                        )}
                      </td>
                      {/* STT */}
                      <td className="col-stt">{index + 1}</td>
                      {/* Họ và tên */}
                      <td>
                        <input
                          className="dktt-table-input"
                          type="text"
                          value={member.fullName}
                          onChange={e => updateFamilyMember(member.id, 'fullName', e.target.value)}
                          placeholder="Họ và tên"
                        />
                      </td>
                      {/* Ngày sinh */}
                      <td>
                        <input
                          className="dktt-table-input"
                          type="date"
                          value={member.dateOfBirth}
                          onChange={e => updateFamilyMember(member.id, 'dateOfBirth', e.target.value)}
                        />
                      </td>
                      {/* Giới tính */}
                      <td>
                        <select
                          className="dktt-table-select"
                          value={member.gender}
                          onChange={e => updateFamilyMember(member.id, 'gender', e.target.value)}
                        >
                          <option value="">-- Chọn --</option>
                          {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </td>
                      {/* CCCD */}
                      <td>
                        <input
                          className="dktt-table-input"
                          type="text"
                          maxLength={12}
                          value={member.citizenId}
                          onChange={e => updateFamilyMember(member.id, 'citizenId', e.target.value.replace(/\D/g, ''))}
                          placeholder="12 chữ số"
                        />
                      </td>
                      {/* Nghề nghiệp */}
                      <td>
                        <select
                          className="dktt-table-select"
                          value={member.occupation}
                          onChange={e => updateFamilyMember(member.id, 'occupation', e.target.value)}
                        >
                          <option value="">-- Chọn --</option>
                          {OCCUPATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      {/* Nơi làm việc */}
                      <td>
                        <input
                          className="dktt-table-input"
                          type="text"
                          value={member.workplace}
                          onChange={e => updateFamilyMember(member.id, 'workplace', e.target.value)}
                          placeholder="Nơi làm việc"
                        />
                      </td>
                      {/* Quan hệ chủ hộ */}
                      <td>
                        <select
                          className="dktt-table-select"
                          value={member.relationshipWithHouseholder}
                          onChange={e => updateFamilyMember(member.id, 'relationshipWithHouseholder', e.target.value)}
                        >
                          <option value="">-- Chọn --</option>
                          {RELATIONSHIP_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="dktt-note" style={{ marginTop: 8 }}>
              * Nhấn nút <strong style={{ color: 'var(--primary)' }}>+</strong> để thêm thành viên. Từ dòng thứ 2 trở đi có thể xóa dòng bằng nút <strong style={{ color: 'var(--danger)' }}>✕</strong>.
            </p>
          </div>
            );
          })()}
        </div>
      );
    }

    if (section.id === 'co-quan') {
      return (
        <>
          {renderFields(section.fieldIds)}
          {administrativeError && (
            <p className="form-error-msg" role="alert" style={{ marginTop: 10 }}>
              ⚠️ {administrativeError}
            </p>
          )}
        </>
      );
    }

    // Section with custom content
    if (section.customContent === 'upload') return renderUploadSection();
    if (section.customContent === 'vneid') return renderVNeIDSection();

    // Default: render fields
    const colClass = section.fieldIds.length <= 2 ? 'cols-2' :
                     section.fieldIds.length === 3 ? 'cols-3' : '';
    return renderFields(section.fieldIds, colClass);
  };

  return (
    <div className="main-content animate-slide-up">
      {/* Breadcrumb */}
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

      <div className="service-page">
        {/* Main Form */}
        <div>
          {/* Page Header */}
          <div className="dktt-page-header" data-highlight-id="form-section">
            <h1>ĐĂNG KÝ THƯỜNG TRÚ</h1>
            <p>Cổng Dịch vụ Công — Bộ Công An</p>
          </div>

          {/* AI hint */}
          <div
            style={{
              background: '#FFF3EE',
              border: '1px solid #C8441A',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              marginBottom: 20,
              fontSize: '0.8375rem',
              color: '#8B1A1A',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
            data-highlight-id="ai-hint"
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <img src="/logo_Gov_Bridge.jpg" alt="AI" style={{
                width: 24, height: 24, borderRadius: '50%', objectFit: 'cover',
                border: '1px solid #C8441A',
              }} />
            </span>
            <span>
              <strong>Mẹo:</strong> Nhấn vào nút Trợ lý AI (góc phải) để tự động điền
              form bằng <strong>giọng nói</strong> hoặc <strong>ảnh CCCD</strong>!
            </span>
          </div>

          {/* Required fields note */}
          <div className="dktt-required-note">
            <strong>Ghi chú:</strong> Các thông tin có dấu{' '}
            <span className="red">(*)</span> là thông tin bắt buộc phải nhập
          </div>

          {/* Accordion Sections */}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSection(section.id);
                  }
                }}
              >
                <div className="dktt-section-header-left">
                  <span className="dktt-section-number">{section.number}</span>
                  <h3 className="dktt-section-title">{section.title}</h3>
                </div>
                <ChevronDown size={20} className="dktt-section-chevron" />
              </div>
              <div className="dktt-section-body">
                {renderSectionContent(section)}
              </div>
            </div>
          ))}

          {/* Legal checkbox */}
          <label className="dktt-legal-check">
            <input
              type="checkbox"
              checked={agreedLegal}
              onChange={(e) => setAgreedLegal(e.target.checked)}
            />
            <span>
              Tôi xin chịu trách nhiệm trước pháp luật về lời khai trên
            </span>
          </label>

          {/* Action buttons */}
          <div className="dktt-actions">
            <button
              className="btn btn-outline"
              onClick={() => navigate('/')}
            >
              <ArrowLeft size={16} />
              Quay lại
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleSaveDraft}
            >
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

        {/* Sidebar */}
        <aside className="service-sidebar" aria-label="Thông tin dịch vụ">
          {/* Required docs */}
          <div className="sidebar-info-card">
            <div className="sidebar-info-card-header">
              <div className="sidebar-info-card-title">
                Giấy tờ cần chuẩn bị
              </div>
            </div>
            <div className="sidebar-info-card-body">
              <ul className="info-list">
                {service.requiredDocs.map((doc, i) => (
                  <li key={i} className="info-list-item">{doc}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Steps */}
          <div className="sidebar-info-card">
            <div className="sidebar-info-card-header">
              <div className="sidebar-info-card-title">Các bước thực hiện</div>
            </div>
            <div className="sidebar-info-card-body">
              <ol className="steps-list">
                {service.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          </div>

          {/* Meta info */}
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

          {/* AI assistant prompt */}
          <div style={{
            background: 'linear-gradient(135deg, #8B1A1A, #C8441A)',
            color: 'white',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            textAlign: 'center',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <img src="/logo_Gov_Bridge.jpg" alt="AI" style={{
                width: 44, height: 44, borderRadius: '50%', objectFit: 'cover',
                border: '2px solid rgba(255,255,255,0.9)', padding: 2, background: 'white',
              }} />
            </div>
            <div style={{ fontWeight: 700, marginBottom: 6, fontSize: '0.9375rem' }}>
              Cần hỗ trợ?
            </div>
            <p style={{ fontSize: '0.8rem', opacity: 0.9, lineHeight: 1.5, marginBottom: 12 }}>
              Trợ lý AI sẵn sàng điền form tự động từ giọng nói hoặc ảnh CCCD của bạn!
            </p>
            <div style={{
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              fontSize: '0.8rem',
              border: '1px solid rgba(255,255,255,0.25)',
            }}>
              👉 Nhấn nút <img src="/logo_Gov_Bridge.jpg" alt="AI" style={{
                width: 16, height: 16, borderRadius: '50%', objectFit: 'cover',
                verticalAlign: 'middle', margin: '0 4px', display: 'inline-block',
                border: '1px solid white',
              }} /> góc phải màn hình
            </div>
          </div>
        </aside>
      </div>

      {/* Success toasts */}
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
    </div>
  );
};

export default DangKyThuongTruPage;
