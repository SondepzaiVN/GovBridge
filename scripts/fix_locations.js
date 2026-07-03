const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'frontend/src/components/pages/LienThongKhaiSinhPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add imports
content = content.replace(
  "import { useForm } from '../../contexts/FormContext';",
  "import { useForm } from '../../contexts/FormContext';\nimport { provinces, getKhaiSinhAgencyName, getResidenceAgencyName, getBhytAgencyName, useWards } from '../../hooks/useAdministrativeUnits';"
);

// Remove mock data
content = content.replace(/const provinceOptions = \[.*?\];/s, '');
content = content.replace(/const wardOptions = \[.*?\];/s, '');

// Convert const steps to getSteps function
content = content.replace(
  'const steps: LinkedStep[] = [',
  'const getSteps = (opts: Record<string, string[] | undefined>): LinkedStep[] => ['
);

// We need to replace provinceOptions with provinces globally inside getSteps
content = content.replace(/provinceOptions/g, 'provinces');

// Replace wardOptions with specific options from opts
content = content.replace(
  /\{ id: 'ltks_phuongKhaiSinh', label: 'Phường\/Xã', type: 'select', required: true, options: wardOptions, value: 'Phường Cái Khế' \}/g,
  "{ id: 'ltks_phuongKhaiSinh', label: 'Phường/Xã', type: 'select', required: true, options: opts.wardsKhaiSinh }"
);

content = content.replace(
  /\{ id: 'ltks_tinhKhaiSinh', label: 'Tỉnh\/Thành phố', type: 'select', required: true, options: provinces, value: 'Thành phố Cần Thơ' \}/g,
  "{ id: 'ltks_tinhKhaiSinh', label: 'Tỉnh/Thành phố', type: 'select', required: true, options: provinces }"
);

content = content.replace(
  /\{ id: 'ltks_phuongThuongTru', label: 'Phường\/Xã', type: 'select', required: true, options: wardOptions, value: 'Phường Cái Khế' \}/g,
  "{ id: 'ltks_phuongThuongTru', label: 'Phường/Xã', type: 'select', required: true, options: opts.wardsThuongTru }"
);
content = content.replace(
  /\{ id: 'ltks_tinhThuongTru', label: 'Tỉnh\/Thành phố', type: 'select', required: true, options: provinces, value: 'Thành phố Cần Thơ' \}/g,
  "{ id: 'ltks_tinhThuongTru', label: 'Tỉnh/Thành phố', type: 'select', required: true, options: provinces }"
);


content = content.replace(
  /\{ id: 'ltks_phuongNguoiYeuCau', label: 'Phường\/Xã', type: 'select', required: true, span: 6, options: wardOptions \}/g,
  "{ id: 'ltks_phuongNguoiYeuCau', label: 'Phường/Xã', type: 'select', required: true, span: 6, options: opts.wardsNguoiYeuCau }"
);

content = content.replace(
  /\{ id: 'ltks_phuongNoiSinh', label: 'Phường\/Xã', type: 'select', required: true, span: 4, options: wardOptions \}/g,
  "{ id: 'ltks_phuongNoiSinh', label: 'Phường/Xã', type: 'select', required: true, span: 4, options: opts.wardsNoiSinh }"
);

content = content.replace(
  /\{ id: 'ltks_phuongQueQuan', label: 'Phường\/Xã', type: 'select', span: 4, options: wardOptions \}/g,
  "{ id: 'ltks_phuongQueQuan', label: 'Phường/Xã', type: 'select', span: 4, options: opts.wardsQueQuan }"
);

content = content.replace(
  /\{ id: 'ltks_phuongMe', label: 'Phường\/Xã', type: 'select', required: true, span: 6, options: wardOptions \}/g,
  "{ id: 'ltks_phuongMe', label: 'Phường/Xã', type: 'select', required: true, span: 6, options: opts.wardsMe }"
);

content = content.replace(
  /\{ id: 'ltks_phuongCha', label: 'Phường\/Xã', type: 'select', required: true, span: 6, options: wardOptions \}/g,
  "{ id: 'ltks_phuongCha', label: 'Phường/Xã', type: 'select', required: true, span: 6, options: opts.wardsCha }"
);

content = content.replace(
  /\{ id: 'ltks_phuongDangKyThuongTru', label: 'Phường\/Xã', type: 'select', required: true, span: 6, options: wardOptions \}/g,
  "{ id: 'ltks_phuongDangKyThuongTru', label: 'Phường/Xã', type: 'select', required: true, span: 6, options: opts.wardsDangKyThuongTru }"
);


// Replace static steps with dynamic usage in the component
content = content.replace(
  "const LienThongKhaiSinhPage: React.FC = () => {",
  `const LienThongKhaiSinhPage: React.FC = () => {
  const { formState, setFieldValue, setFieldError, touchField, resetForm } = useForm();
  
  const { wardOptions: wardsKhaiSinh } = useWards(formState.values.ltks_tinhKhaiSinh);
  const { wardOptions: wardsThuongTru } = useWards(formState.values.ltks_tinhThuongTru);
  const { wardOptions: wardsNguoiYeuCau } = useWards(formState.values.ltks_tinhNguoiYeuCau);
  const { wardOptions: wardsNoiSinh } = useWards(formState.values.ltks_tinhNoiSinh);
  const { wardOptions: wardsQueQuan } = useWards(formState.values.ltks_tinhQueQuan);
  const { wardOptions: wardsMe } = useWards(formState.values.ltks_tinhMe);
  const { wardOptions: wardsCha } = useWards(formState.values.ltks_tinhCha);
  const { wardOptions: wardsDangKyThuongTru } = useWards(formState.values.ltks_tinhDangKyThuongTru);

  const steps = React.useMemo(() => getSteps({
    wardsKhaiSinh,
    wardsThuongTru,
    wardsNguoiYeuCau,
    wardsNoiSinh,
    wardsQueQuan,
    wardsMe,
    wardsCha,
    wardsDangKyThuongTru
  }), [
    wardsKhaiSinh, wardsThuongTru, wardsNguoiYeuCau, wardsNoiSinh,
    wardsQueQuan, wardsMe, wardsCha, wardsDangKyThuongTru
  ]);

  const handleChangeField = (fieldId: string, value: string) => {
    setFieldValue(fieldId, value);
    
    // Cascade Reset logic
    if (fieldId === 'ltks_tinhKhaiSinh') {
      setFieldValue('ltks_phuongKhaiSinh', '');
      setFieldValue('ltks_coQuanDangKyKhaiSinh', '');
      setFieldValue('ltks_coQuanCapBhyt', '');
    }
    if (fieldId === 'ltks_phuongKhaiSinh') {
      setFieldValue('ltks_coQuanDangKyKhaiSinh', getKhaiSinhAgencyName(value));
      setFieldValue('ltks_coQuanCapBhyt', getBhytAgencyName(value));
    }
    
    if (fieldId === 'ltks_tinhThuongTru') {
      setFieldValue('ltks_phuongThuongTru', '');
      setFieldValue('ltks_coQuanDangKyThuongTru', '');
    }
    if (fieldId === 'ltks_phuongThuongTru') {
      setFieldValue('ltks_coQuanDangKyThuongTru', getResidenceAgencyName(value));
    }

    if (fieldId === 'ltks_tinhNguoiYeuCau') setFieldValue('ltks_phuongNguoiYeuCau', '');
    if (fieldId === 'ltks_tinhNoiSinh') setFieldValue('ltks_phuongNoiSinh', '');
    if (fieldId === 'ltks_tinhQueQuan') setFieldValue('ltks_phuongQueQuan', '');
    if (fieldId === 'ltks_tinhMe') setFieldValue('ltks_phuongMe', '');
    if (fieldId === 'ltks_tinhCha') setFieldValue('ltks_phuongCha', '');
    if (fieldId === 'ltks_tinhDangKyThuongTru') setFieldValue('ltks_phuongDangKyThuongTru', '');
  };
`
);

// We need to remove the original useForm declaration
content = content.replace(
  "const { formState, setFieldValue, setFieldError, touchField, resetForm } = useForm();",
  "// useForm handled above"
);

// Replace setFieldValue calls inside the grid with handleChangeField
content = content.replace(
  /onChange=\{\(value\) => setFieldValue\(field\.id, value\)\}/g,
  "onChange={(value) => handleChangeField(field.id, value)}"
);

// Remove the parseStep that references a globally scoped steps
content = content.replace(/const parseStep = \(stepSlug\?: string\) => \{[\s\S]*?\};/, '');
// Inject it inside LienThongKhaiSinhPage
content = content.replace(
  'const { stepSlug } = useParams();',
  `const { stepSlug } = useParams();\n  const parseStep = (slug?: string) => {\n    const match = slug?.match(/^buoc-(\\d+)$/);\n    return Math.min(Math.max(match ? Number(match[1]) : 1, 1), steps.length);\n  };\n`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully refactored LienThongKhaiSinhPage.tsx');
