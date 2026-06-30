import React from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Download, Menu, Minus, MoreVertical, Plus, Printer, RotateCw, UploadCloud } from 'lucide-react';
import { applicationService } from '../../api/applicationService';
import { ApiClientError } from '../../api/client';
import { useForm } from '../../contexts/FormContext';

type FieldType = 'text' | 'date' | 'select' | 'textarea' | 'radio' | 'checkbox';

interface LinkedField {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  value?: string;
  options?: string[];
  wide?: boolean;
  span?: 3 | 4 | 6 | 8 | 12;
  dotted?: boolean;
  hideLabel?: boolean;
  readOnly?: boolean;
}

interface LinkedSection {
  title: string;
  note?: string;
  actions?: string[];
  sameArea?: boolean;
  fields?: LinkedField[];
  reviewTabs?: ReviewTab[];
  uploads?: Array<{ title: string; desc: string }>;
  review?: boolean;
}

interface LinkedStep {
  title: string;
  shortTitle: string;
  sections: LinkedSection[];
}

interface ReviewTab {
  title: string;
  url: string;
  pageCount: number;
  formTitle: string;
  recipient: string;
  description: string;
}

const resultMethods = [
  'Dịch vụ bưu chính công ích',
  'Tại nơi nhận kết quả khai sinh (UBND)',
  'Tại cơ quan BHXH cấp thẻ BHYT',
  'Chỉ nhận bản điện tử',
];

const birthTypeOptions = [
  'Không có yếu tố nước ngoài',
  'Có yếu tố nước ngoài thuộc các xã vùng biên',
  'Có yếu tố nước ngoài không thuộc các xã vùng biên',
];

const birthCaseOptions = [
  'Đã xác định được cả cha lẫn mẹ',
  'Chưa xác định được mẹ',
  'Chưa xác định được cha',
  'Chưa xác định được cả cha lẫn mẹ',
  'Trẻ bị bỏ rơi',
];

const residenceCaseOptions = [
  'Con về với cha, mẹ; cha, mẹ không là chủ sở hữu chỗ ở hợp pháp',
  'Trẻ em mới sinh về với người giám hộ',
  'Trẻ em về với người thân khác',
  'Đăng ký thường trú tại cơ sở tín ngưỡng, cơ sở tôn giáo',
  'Đăng ký thường trú tại cơ sở trợ giúp xã hội hoặc hộ gia đình nhận chăm sóc, nuôi dưỡng...',
  'Đăng ký thường trú tại phương tiện',
];

const genderOptions = ['Nam', 'Nữ'];
const provinceOptions = ['Thành phố Hà Nội', 'Thành phố Cần Thơ', 'Thành phố Hồ Chí Minh', 'Thành phố Đà Nẵng'];
const wardOptions = ['Phường Cái Khế', 'Phường Cửa Nam', 'Phường Hàng Bạc', 'Phường Bến Nghé'];
const countryOptions = ['Cộng hòa XHCN Việt Nam'];
const nationalityOptions = ['Việt Nam'];
const ethnicityOptions = ['Kinh', 'Tày', 'Thái', 'Mường', 'Khác'];
const residenceTypeOptions = ['Thường trú', 'Tạm trú', 'Nơi ở hiện tại'];
const requesterRelationOptions = ['Cha', 'Mẹ', 'Ông', 'Bà', 'Người giám hộ', 'Người thân thích khác'];
const guardianOptions = ['Thông tin cha', 'Thông tin mẹ', 'Thông tin người yêu cầu'];
const healthcareOptions = ['Trạm y tế phường/xã', 'Bệnh viện đa khoa khu vực', 'Bệnh viện tuyến huyện'];
const reviewTabs: ReviewTab[] = [
  {
    title: 'Tờ khai đăng ký khai sinh',
    url: '/lien-thong-khai-sinh/tokhai_khaisinh.pdf',
    pageCount: 2,
    formTitle: 'TỜ KHAI ĐĂNG KÝ KHAI SINH',
    recipient: 'Ủy ban nhân dân cấp xã nơi thực hiện đăng ký khai sinh',
    description: 'Tờ khai đăng ký khai sinh cho trẻ em dưới 6 tuổi.',
  },
  {
    title: 'Tờ khai thay đổi thông tin cư trú (CT01)',
    url: '/lien-thong-khai-sinh/tokhai_cutru.pdf',
    pageCount: 2,
    formTitle: 'TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ',
    recipient: 'Cơ quan đăng ký cư trú',
    description: 'Thông tin đăng ký thường trú cho trẻ sau khi đăng ký khai sinh.',
  },
  {
    title: 'Tờ khai tham gia, điều chỉnh thông tin BHXH, BHYT (TK1-TS)',
    url: '/lien-thong-khai-sinh/tokhai_bhyt.pdf',
    pageCount: 2,
    formTitle: 'TỜ KHAI THAM GIA, ĐIỀU CHỈNH THÔNG TIN BHXH, BHYT',
    recipient: 'Cơ quan Bảo hiểm xã hội',
    description: 'Thông tin cấp thẻ bảo hiểm y tế cho trẻ em dưới 6 tuổi.',
  },
  {
    title: 'Tờ khai mẫu 01',
    url: '/lien-thong-khai-sinh/tokhai_mau01.pdf',
    pageCount: 3,
    formTitle: 'MẪU SỐ 01',
    recipient: 'Cơ quan tiếp nhận hồ sơ liên thông',
    description: 'Phiếu thông tin dùng trong quy trình liên thông khai sinh, thường trú, BHYT.',
  },
];

const steps: LinkedStep[] = [
  {
    title: 'Lựa chọn cơ quan thực hiện',
    shortTitle: 'Lựa chọn cơ quan thực hiện',
    sections: [
      {
        title: 'Cơ quan thực hiện đăng ký khai sinh',
        fields: [
          { id: 'ltks_loaiKhaiSinh', label: 'Loại khai sinh', type: 'select', required: true, wide: true, options: birthTypeOptions },
          { id: 'ltks_tinhKhaiSinh', label: 'Tỉnh/Thành phố', type: 'select', required: true, options: ['Thành phố Hà Nội', 'Thành phố Hồ Chí Minh', 'Thành phố Đà Nẵng'] },
          { id: 'ltks_phuongKhaiSinh', label: 'Phường/Xã', type: 'select', required: true, options: ['Phường Cửa Nam', 'Phường Hàng Bạc', 'Phường Bến Nghé'] },
          { id: 'ltks_coQuanDangKyKhaiSinh', label: 'Cơ quan thực hiện', type: 'text', required: true, wide: true, dotted: true, readOnly: true, value: 'Cơ quan X' },
          { id: 'ltks_truongHopKhaiSinh', label: 'Trường hợp khai sinh', type: 'select', required: true, wide: true, options: birthCaseOptions },
        ],
      },
      {
        title: 'Cơ quan thực hiện đăng ký thường trú',
        sameArea: true,
        fields: [
          { id: 'ltks_tinhThuongTru', label: 'Tỉnh/Thành phố', type: 'select', required: true, options: ['Thành phố Hà Nội', 'Thành phố Hồ Chí Minh', 'Thành phố Đà Nẵng'] },
          { id: 'ltks_phuongThuongTru', label: 'Phường/Xã', type: 'select', required: true, options: ['Phường Cửa Nam', 'Phường Hàng Bạc', 'Phường Bến Nghé'] },
          { id: 'ltks_coQuanDangKyThuongTru', label: 'Cơ quan thực hiện', type: 'text', required: true, wide: true, dotted: true, readOnly: true, value: 'Cơ quan X' },
          { id: 'ltks_truongHopDangKyThuongTru', label: 'Trường hợp ĐKTT', type: 'select', required: true, wide: true, options: residenceCaseOptions },
        ],
      },
      {
        title: 'Cơ quan thực hiện cấp thẻ BHYT',
        fields: [
          { id: 'ltks_coQuanCapBhyt', label: 'Cơ quan thực hiện', type: 'text', required: true, wide: true, dotted: true, readOnly: true, value: 'Cơ quan X' },
        ],
      },
    ],
  },
  {
    title: 'Thông tin kê khai',
    shortTitle: 'Kê khai',
    sections: [
      {
        title: 'Thông tin người yêu cầu',
        actions: ['Xác thực với CSDLQG về dân cư'],
        fields: [
          { id: 'ltks_hoTenNguoiYeuCau', label: 'Họ, chữ đệm, tên người yêu cầu', type: 'text', required: true },
          { id: 'ltks_soDinhDanhNguoiYeuCau', label: 'Số định danh', type: 'text', required: true },
          { id: 'ltks_ngaySinhNguoiYeuCau', label: 'Ngày sinh người yêu cầu', type: 'date', required: true },
          { id: 'ltks_gioiTinhNguoiYeuCau', label: 'Giới tính', type: 'select', required: true, options: genderOptions },
          { id: 'ltks_ngayCapNguoiYeuCau', label: 'Ngày cấp', type: 'date', required: true, span: 6 },
          { id: 'ltks_noiCapNguoiYeuCau', label: 'Nơi cấp', type: 'text', required: true, span: 6 },
          { id: 'ltks_loaiCuTruNguoiYeuCau', label: 'Loại cư trú', type: 'select', required: true, span: 6, options: residenceTypeOptions },
          { id: 'ltks_quocGiaNguoiYeuCau', label: 'Quốc gia', type: 'select', required: true, span: 6, options: countryOptions, value: 'Cộng hòa XHCN Việt Nam' },
          { id: 'ltks_tinhNguoiYeuCau', label: 'Tỉnh/Thành phố', type: 'select', required: true, span: 6, options: provinceOptions },
          { id: 'ltks_phuongNguoiYeuCau', label: 'Phường/Xã', type: 'select', required: true, span: 6, options: wardOptions },
          { id: 'ltks_chiTietNguoiYeuCau', label: 'Chi tiết', type: 'text', required: true, wide: true },
          { id: 'ltks_quanHeVoiTre', label: 'Quan hệ với người được khai sinh', type: 'select', required: true, span: 4, options: requesterRelationOptions },
          { id: 'ltks_sdtNguoiYeuCau', label: 'Số điện thoại', type: 'text', required: true, span: 4 },
          { id: 'ltks_emailNguoiYeuCau', label: 'Email', type: 'text', span: 4 },
        ],
      },
      {
        title: 'Thông tin người được khai sinh',
        fields: [
          { id: 'ltks_nhapThongTinTre', label: 'Phương thức nhập', type: 'radio', required: true, wide: true, hideLabel: true, options: ['Nhập tay', 'Lấy dữ liệu chứng sinh từ CSDL Bảo hiểm'], value: 'Nhập tay' },
          { id: 'ltks_hoTre', label: 'Họ người được khai sinh', type: 'text' },
          { id: 'ltks_chuDemTre', label: 'Chữ đệm người được khai sinh', type: 'text' },
          { id: 'ltks_tenTre', label: 'Tên người được khai sinh', type: 'text', required: true },
          { id: 'ltks_ngaySinhTre', label: 'Ngày tháng năm sinh', type: 'date', required: true },
          { id: 'ltks_ngaySinhBangChu', label: 'Ghi bằng chữ', type: 'text', required: true, span: 8 },
          { id: 'ltks_quocGiaNoiSinh', label: 'Quốc gia', type: 'select', required: true, span: 4, options: countryOptions, value: 'Cộng hòa XHCN Việt Nam' },
          { id: 'ltks_tinhNoiSinh', label: 'Tỉnh/Thành phố', type: 'select', required: true, span: 4, options: provinceOptions },
          { id: 'ltks_phuongNoiSinh', label: 'Phường/Xã', type: 'select', required: true, span: 4, options: wardOptions },
          { id: 'ltks_chiTietNoiSinh', label: 'Chi tiết', type: 'text', wide: true },
          { id: 'ltks_gioiTinhTre', label: 'Giới tính', type: 'select', required: true, span: 4, options: genderOptions },
          { id: 'ltks_quocTichTre', label: 'Quốc tịch', type: 'select', required: true, span: 4, options: nationalityOptions, value: 'Việt Nam' },
          { id: 'ltks_danTocTre', label: 'Dân tộc', type: 'select', required: true, span: 4, options: ethnicityOptions, value: 'Kinh' },
        ],
      },
      {
        title: 'Quê quán',
        fields: [
          { id: 'ltks_quocGiaQueQuan', label: 'Quốc gia', type: 'select', required: true, span: 4, options: countryOptions, value: 'Cộng hòa XHCN Việt Nam' },
          { id: 'ltks_tinhQueQuan', label: 'Tỉnh/Thành phố', type: 'select', required: true, span: 4, options: provinceOptions },
          { id: 'ltks_phuongQueQuan', label: 'Phường/Xã', type: 'select', span: 4, options: wardOptions },
          { id: 'ltks_chiTietQueQuan', label: 'Chi tiết', type: 'text', span: 8 },
          { id: 'ltks_soLuongBanSao', label: 'Số lượng', type: 'text', span: 4, value: '1' },
        ],
      },
      {
        title: 'Thông tin người mẹ đẻ/nhờ mang thai hộ',
        actions: ['Xác thực với CSDLQG về dân cư', 'Nhập lại'],
        fields: [
          { id: 'ltks_quocTichMe', label: 'Quốc tịch', type: 'select', required: true, span: 6, options: nationalityOptions, value: 'Việt Nam' },
          { id: 'ltks_danTocMe', label: 'Dân tộc', type: 'select', required: true, span: 6, options: ethnicityOptions, value: 'Kinh' },
          { id: 'ltks_hoMe', label: 'Họ mẹ', type: 'text', span: 4 },
          { id: 'ltks_chuDemMe', label: 'Chữ đệm mẹ', type: 'text', span: 4 },
          { id: 'ltks_tenMe', label: 'Tên mẹ', type: 'text', required: true, span: 4 },
          { id: 'ltks_ngaySinhMe', label: 'Ngày tháng năm sinh', type: 'date', span: 6 },
          { id: 'ltks_soDinhDanhMe', label: 'Số định danh', type: 'text', required: true, span: 6 },
          { id: 'ltks_loaiCuTruMe', label: 'Loại cư trú', type: 'select', required: true, span: 6, options: residenceTypeOptions },
          { id: 'ltks_quocGiaMe', label: 'Quốc gia', type: 'select', required: true, span: 6, options: countryOptions, value: 'Cộng hòa XHCN Việt Nam' },
          { id: 'ltks_tinhMe', label: 'Tỉnh/Thành phố', type: 'select', required: true, span: 6, options: provinceOptions },
          { id: 'ltks_phuongMe', label: 'Phường/Xã', type: 'select', required: true, span: 6, options: wardOptions },
          { id: 'ltks_chiTietMe', label: 'Chi tiết', type: 'text', wide: true },
        ],
      },
      {
        title: 'Thông tin người cha đẻ/nhờ mang thai hộ',
        actions: ['Xác thực với CSDLQG về dân cư', 'Nhập lại'],
        fields: [
          { id: 'ltks_cungNoiCuTruVoiMe', label: 'Cùng nơi cư trú với mẹ', type: 'radio', wide: true, options: ['Có', 'Không'], value: 'Không' },
          { id: 'ltks_quocTichCha', label: 'Quốc tịch', type: 'select', required: true, span: 6, options: nationalityOptions, value: 'Việt Nam' },
          { id: 'ltks_danTocCha', label: 'Dân tộc', type: 'select', required: true, span: 6, options: ethnicityOptions, value: 'Kinh' },
          { id: 'ltks_hoCha', label: 'Họ cha', type: 'text', span: 4 },
          { id: 'ltks_chuDemCha', label: 'Chữ đệm cha', type: 'text', span: 4 },
          { id: 'ltks_tenCha', label: 'Tên cha', type: 'text', required: true, span: 4 },
          { id: 'ltks_ngaySinhCha', label: 'Ngày tháng năm sinh', type: 'date', span: 6 },
          { id: 'ltks_soDinhDanhCha', label: 'Số định danh', type: 'text', required: true, span: 6 },
          { id: 'ltks_loaiCuTruCha', label: 'Loại cư trú', type: 'select', required: true, span: 4, options: residenceTypeOptions },
          { id: 'ltks_quocGiaCha', label: 'Quốc gia', type: 'select', required: true, span: 4, options: countryOptions, value: 'Cộng hòa XHCN Việt Nam' },
          { id: 'ltks_tinhCha', label: 'Tỉnh/Thành phố', type: 'select', required: true, span: 4, options: provinceOptions },
          { id: 'ltks_phuongCha', label: 'Phường/Xã', type: 'select', required: true, span: 6, options: wardOptions },
          { id: 'ltks_chiTietCha', label: 'Chi tiết', type: 'text', wide: true },
        ],
      },
      {
        title: 'Thông tin về Giấy chứng nhận kết hôn của cha, mẹ trẻ (nếu cha, mẹ trẻ có đăng ký kết hôn)',
        fields: [
          { id: 'ltks_soGiayCnkh', label: 'Số', type: 'text', span: 6 },
          { id: 'ltks_quyenSoGiayCnkh', label: 'Quyển số', type: 'text', span: 6 },
          { id: 'ltks_ngayCapGiayCnkh', label: 'Ngày cấp', type: 'date', span: 6 },
          { id: 'ltks_noiCapGiayCnkh', label: 'Nơi cấp', type: 'text', span: 6 },
        ],
      },
      {
        title: 'Thông tin đăng ký thường trú',
        fields: [
          {
            id: 'ltks_xacNhanDangKyThuongTru',
            label: 'Hình thức xác nhận đăng ký thường trú',
            type: 'radio',
            required: true,
            wide: true,
            hideLabel: true,
            options: [
              'Xin xác nhận của Chủ hộ, Chủ sở hữu chỗ ở hợp pháp, Cha/mẹ/người giám hộ bằng văn bản giấy hoặc chữ ký vào tờ khai CT01 bản giấy',
              'Xin xác nhận của Chủ hộ, Chủ sở hữu chỗ ở hợp pháp, Cha/mẹ/người giám hộ qua VNEID',
            ],
            value: 'Xin xác nhận của Chủ hộ, Chủ sở hữu chỗ ở hợp pháp, Cha/mẹ/người giám hộ bằng văn bản giấy hoặc chữ ký vào tờ khai CT01 bản giấy',
          },
        ],
      },
      {
        title: 'Thông tin chủ hộ',
        fields: [
          { id: 'ltks_chuHoLaChaMe', label: 'Chủ hộ là cha/mẹ', type: 'checkbox', wide: true, hideLabel: true, options: ['Bố là chủ hộ', 'Mẹ là chủ hộ'] },
          { id: 'ltks_hoTenChuHo', label: 'Họ, chữ đệm, tên chủ hộ', type: 'text', required: true, span: 4 },
          { id: 'ltks_soDinhDanhChuHo', label: 'Số định danh', type: 'text', required: true, span: 4 },
          { id: 'ltks_quanHeVoiChuHo', label: 'Mối quan hệ của người được khai sinh với chủ hộ', type: 'select', required: true, span: 4, options: ['Con', 'Cháu', 'Người được giám hộ', 'Khác'] },
        ],
      },
      {
        title: 'Nơi đề nghị đăng ký thường trú',
        fields: [
          { id: 'ltks_tinhDangKyThuongTru', label: 'Tỉnh/Thành phố', type: 'select', required: true, span: 6, options: provinceOptions },
          { id: 'ltks_phuongDangKyThuongTru', label: 'Phường/Xã', type: 'select', required: true, span: 6, options: wardOptions },
          { id: 'ltks_chiTietDangKyThuongTru', label: 'Chi tiết', type: 'text', required: true, wide: true },
        ],
      },
      {
        title: 'Thông tin cấp thẻ BHYT',
        fields: [
          { id: 'ltks_noiKhamChuaBenhBanDau', label: 'Nơi khám chữa bệnh ban đầu', type: 'select', required: true, span: 6, options: healthcareOptions },
          { id: 'ltks_thongTinGiamHoTrenThe', label: 'Thông tin giám hộ trên thẻ', type: 'select', required: true, span: 6, options: guardianOptions },
          { id: 'ltks_soGiayChungNhanHoNgheo', label: 'Số giấy chứng nhận hộ nghèo', type: 'text', span: 6 },
          { id: 'ltks_ngayCapGiayChungNhanHoNgheo', label: 'Ngày cấp', type: 'date', span: 6 },
        ],
      },
    ],
  },
  {
    title: 'Xem lại các tờ khai chi tiết',
    shortTitle: 'Xem lại các tờ khai chi tiết',
    sections: [
      {
        title: 'Xem lại các tờ khai chi tiết',
        reviewTabs,
      },
    ],
  },
  {
    title: 'Đính kèm thành phần hồ sơ',
    shortTitle: 'Đính kèm thành phần hồ sơ',
    sections: [
      {
        title: 'Đính kèm thành phần hồ sơ',
        uploads: [
          { title: 'Tờ khai đăng ký khai sinh', desc: 'PDF, PNG, JPG tối đa 5MB' },
          { title: 'Tờ khai thay đổi thông tin cư trú (CT01)', desc: 'Bản ký số hoặc bản scan' },
          { title: 'Tờ khai tham gia, điều chỉnh thông tin BHXH, BHYT (TK1-TS)', desc: 'Mẫu TK1-TS' },
          { title: 'Giấy chứng sinh', desc: 'Mã giấy chứng sinh hoặc file đính kèm' },
        ],
      },
    ],
  },
  {
    title: 'Lựa chọn hình thức nhận kết quả',
    shortTitle: 'Lựa chọn hình thức nhận kết quả',
    sections: [
      {
        title: 'Hình thức nhận kết quả',
        fields: [
          { id: 'ltks_noiKhamChuaBenh', label: 'Nơi khám chữa bệnh ban đầu', type: 'select', required: true, options: ['Trạm y tế phường/xã', 'Bệnh viện đa khoa khu vực', 'Bệnh viện tuyến huyện'] },
          { id: 'ltks_hinhThucNhanBhyt', label: 'Hình thức nhận thẻ BHYT', type: 'select', required: true, options: resultMethods },
          { id: 'ltks_nhanKhaiSinh', label: 'Hình thức nhận kết quả khai sinh', type: 'select', required: true, options: resultMethods },
          { id: 'ltks_nhanThuongTru', label: 'Hình thức nhận kết quả đăng ký thường trú', type: 'select', required: true, options: resultMethods },
          { id: 'ltks_nhanTheBhyt', label: 'Hình thức nhận thẻ BHYT', type: 'select', required: true, options: resultMethods },
          { id: 'ltks_noiNhanKetQua', label: 'Nơi nhận kết quả', type: 'textarea', required: true, wide: true, placeholder: 'Bộ phận một cửa/địa chỉ nhận qua bưu chính' },
        ],
      },
    ],
  },
  {
    title: 'Hoàn thành',
    shortTitle: 'Hoàn thành',
    sections: [
      { title: 'Xác nhận thông tin hồ sơ', review: true },
    ],
  },
];

const allFields = steps.flatMap((step) => step.sections.flatMap((section) => section.fields ?? []));

const parseStep = (stepSlug?: string) => {
  const match = stepSlug?.match(/^buoc-(\d+)$/);
  const step = match ? Number(match[1]) : 1;
  return Math.min(Math.max(step, 1), steps.length);
};

const LienThongKhaiSinhPage: React.FC = () => {
  const navigate = useNavigate();
  const { stepSlug } = useParams();
  const { formState, setFieldValue, setFieldError, touchField, setIsSubmitting, resetForm } = useForm();
  const [submitError, setSubmitError] = React.useState('');
  const [submittedId, setSubmittedId] = React.useState('');
  const [activeReviewTab, setActiveReviewTab] = React.useState(0);

  const currentStep = parseStep(stepSlug);
  const current = steps[currentStep - 1];

  const goToStep = (step: number) => {
    navigate(`/lien-thong-khai-sinh/buoc-${step}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validateStep = () => {
    const fields = current.sections.flatMap((section) => section.fields ?? []);
    let isValid = true;

    fields.forEach((field) => {
      touchField(field.id);
      const value = formState.values[field.id] ?? field.value ?? '';
      const error = field.required && !String(value).trim() ? 'Vui lòng nhập thông tin bắt buộc.' : '';
      setFieldError(field.id, error);
      if (error) isValid = false;
    });

    return isValid;
  };

  const handleNext = () => {
    setSubmitError('');
    if (!validateStep()) return;
    if (currentStep < steps.length) {
      goToStep(currentStep + 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitError('');
    setSubmittedId('');
    if (!validateStep()) return;

    const missing = allFields.filter((field) => {
      const value = formState.values[field.id] ?? field.value ?? '';
      return field.required && !String(value).trim();
    });

    if (missing.length) {
      missing.forEach((field) => {
        touchField(field.id);
        setFieldError(field.id, 'Vui lòng nhập thông tin bắt buộc.');
      });
      setSubmitError('Vui lòng hoàn thiện các bước trước khi gửi hồ sơ.');
      return;
    }

    try {
      setIsSubmitting(true);
      const application = await applicationService.submit({
        serviceId: 'lien-thong-khai-sinh',
        submittedAt: new Date().toISOString(),
        data: Object.fromEntries(allFields.map((field) => [field.id, formState.values[field.id] ?? field.value ?? ''])),
      });
      setSubmittedId(application.id);
    } catch (error) {
      if (error instanceof ApiClientError) {
        (error.details ?? []).forEach((detail) => {
          if (!detail.field) return;
          touchField(detail.field);
          setFieldError(detail.field, detail.message);
        });
      }
      setSubmitError(error instanceof Error ? error.message : 'Không thể nộp hồ sơ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!stepSlug) return <Navigate to="/lien-thong-khai-sinh/buoc-1" replace />;

  return (
    <LienThongShell>
      <main className="ltks-main">
        <nav className="ltks-breadcrumb" aria-label="Breadcrumb">
          <ChevronRight size={20} />
          <Link to="/">Trang chủ DVCLT</Link>
          <span>/ THÊM MỚI HỒ SƠ DỊCH VỤ CÔNG LIÊN THÔNG ĐĂNG KÝ KHAI SINH, ĐĂNG KÝ THƯỜNG TRÚ, CẤP THẺ BHYT CHO TRẺ DƯỚI 6 TUỔI</span>
        </nav>

        <div className="ltks-stepper" role="tablist" aria-label="Các bước kê khai">
          {steps.map((step, index) => {
            const stepNo = index + 1;
            const state = stepNo === currentStep ? 'active' : stepNo < currentStep ? 'done' : '';
            return (
              <button
                type="button"
                className={`ltks-step ${state}`}
                key={step.title}
                onClick={() => goToStep(stepNo)}
                role="tab"
                aria-selected={stepNo === currentStep}
              >
                <span>{String(stepNo).padStart(2, '0').replace('0', '0 ')}</span>
                <strong>{step.shortTitle}</strong>
              </button>
            );
          })}
        </div>

        <form className={`ltks-form ltks-form-step-${currentStep}`} onSubmit={(event) => event.preventDefault()} noValidate>
          <div className="ltks-form-body">
            {current.sections.map((section) => (
              <section className="ltks-section" key={section.title}>
                {!section.reviewTabs && (
                  <div className="ltks-section-title">
                    <h3>{section.title}</h3>
                    {section.actions && (
                      <div className="ltks-section-actions">
                        {section.actions.map((action) => (
                          <button type="button" key={action}>{action}</button>
                        ))}
                      </div>
                    )}
                    {section.sameArea && (
                      <label className="ltks-inline-check">
                        <input type="checkbox" aria-label="Cùng địa bàn thực hiện đăng ký khai sinh" />
                        Cùng địa bàn thực hiện đăng ký khai sinh
                      </label>
                    )}
                  </div>
                )}
                {section.note && <p className="ltks-note">{section.note}</p>}
                {section.reviewTabs && (
                  <PdfReviewTabs
                    tabs={section.reviewTabs}
                    activeIndex={activeReviewTab}
                    onTabChange={setActiveReviewTab}
                  />
                )}
                {section.fields && (
                  <div className="ltks-grid">
                    {section.fields.map((field) => (
                      <FieldControl
                        key={field.id}
                        field={field}
                        value={formState.values[field.id] ?? field.value ?? ''}
                        error={formState.errors[field.id]}
                        onChange={(value) => setFieldValue(field.id, value)}
                      />
                    ))}
                  </div>
                )}
                {section.uploads && (
                  <div className="ltks-upload-list">
                    {section.uploads.map((upload) => (
                      <button type="button" className="ltks-upload-item" key={upload.title}>
                        <span>
                          <strong>{upload.title}</strong>
                          <small>{upload.desc}</small>
                        </span>
                        <UploadCloud size={20} />
                      </button>
                    ))}
                  </div>
                )}
                {section.review && <ReviewPanel values={formState.values} />}
              </section>
            ))}
          </div>

          {submitError && <div className="ltks-alert error">{submitError}</div>}
          {submittedId && <div className="ltks-alert success">Đã nộp hồ sơ thành công. Mã hồ sơ: {submittedId}</div>}

          <div className="ltks-actions">
            <button type="button" className="ltks-btn ghost" onClick={() => { resetForm(); navigate('/'); }}>
              Hủy
            </button>
            {currentStep > 1 && (
              <button type="button" className="ltks-btn secondary" onClick={() => goToStep(currentStep - 1)}>
                Quay lại bước trước
              </button>
            )}
            {currentStep < steps.length ? (
              <button type="button" className="ltks-btn primary" onClick={handleNext}>
                Chuyển bước tiếp theo
              </button>
            ) : (
              <button type="button" className="ltks-btn primary" disabled={formState.isSubmitting} onClick={handleSubmit}>
                {formState.isSubmitting ? 'Đang nộp...' : 'Gửi hồ sơ'}
              </button>
            )}
          </div>
        </form>
      </main>
    </LienThongShell>
  );
};

const LienThongShell: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="ltks-page ltks-app-page animate-slide-up">
    {children}
  </div>
);

interface FieldControlProps {
  field: LinkedField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

const FieldControl: React.FC<FieldControlProps> = ({ field, value, error, onChange }) => {
  const commonProps = {
    id: field.id,
    value,
    'aria-label': field.label,
    'aria-required': field.required,
    'aria-invalid': !!error,
    'data-highlight-id': field.id,
  };

  return (
    <div className={`ltks-field ${field.wide || field.type === 'textarea' ? 'wide' : ''} ${field.span ? `span-${field.span}` : ''} ${field.dotted ? 'dotted' : ''}`}>
      {!field.hideLabel && <label htmlFor={field.id} className={field.required ? 'required' : ''}>{field.label}</label>}
      {field.type === 'textarea' ? (
        <textarea {...commonProps} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : field.type === 'select' ? (
        <CustomSelect
          id={field.id}
          label={field.label}
          value={value}
          options={field.options ?? []}
          placeholder={field.placeholder ?? ''}
          required={field.required}
          invalid={!!error}
          onChange={onChange}
        />
      ) : field.type === 'radio' ? (
        <div className="ltks-radio-group">
          {field.options?.map((option) => (
            <label key={option}>
              <input type="radio" name={field.id} checked={value === option} onChange={() => onChange(option)} />
              {option}
            </label>
          ))}
        </div>
      ) : field.type === 'checkbox' ? (
        <div className="ltks-checkbox-group">
          {field.options?.map((option) => {
            const values = value ? value.split('|') : [];
            const checked = values.includes(option);
            return (
              <label key={option}>
                <input
                  type="checkbox"
                  name={field.id}
                  checked={checked}
                  onChange={() => {
                    const next = checked ? values.filter((item) => item !== option) : [...values, option];
                    onChange(next.join('|'));
                  }}
                />
                {option}
              </label>
            );
          })}
        </div>
      ) : (
        <input {...commonProps} type={field.type} placeholder={field.placeholder} readOnly={field.readOnly} onChange={(event) => onChange(event.target.value)} />
      )}
      {error && <span className="ltks-error">{error}</span>}
    </div>
  );
};

interface CustomSelectProps {
  id: string;
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  required?: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  id,
  label,
  value,
  options,
  placeholder,
  required,
  invalid,
  onChange,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeOption, setActiveOption] = React.useState(value || options[0] || '');
  const [toastText, setToastText] = React.useState('');
  const rootRef = React.useRef<HTMLDivElement>(null);
  const toastTimerRef = React.useRef<number | null>(null);
  const listboxId = `${id}-listbox`;

  React.useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  React.useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (text: string) => {
    setToastText(text);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastText(''), 900);
  };

  const selectOption = (option: string) => {
    onChange(option);
    setActiveOption(option);
    showToast(option);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!options.length) return;
    const currentIndex = Math.max(options.indexOf(activeOption || value), 0);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveOption(options[Math.min(currentIndex + 1, options.length - 1)]);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      setActiveOption(options[Math.max(currentIndex - 1, 0)]);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isOpen) selectOption(activeOption || options[0]);
      setIsOpen(!isOpen);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="ltks-select" ref={rootRef}>
      <button
        type="button"
        id={id}
        className="ltks-select-trigger"
        aria-label={label}
        aria-required={required}
        aria-invalid={invalid}
        aria-expanded={isOpen}
        aria-controls={listboxId}
        data-highlight-id={id}
        onClick={() => {
          setActiveOption(value || options[0] || '');
          setIsOpen((open) => !open);
        }}
        onKeyDown={handleKeyDown}
      >
        <span>{value || placeholder}</span>
      </button>

      {isOpen && (
        <div className="ltks-select-menu" id={listboxId} role="listbox" aria-label={label}>
          {options.map((option) => {
            const isSelected = value === option;
            const isActive = activeOption === option;
            return (
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`ltks-select-option ${isSelected || isActive ? 'active' : ''}`}
                key={option}
                title={option}
                onMouseEnter={() => setActiveOption(option)}
                onFocus={() => setActiveOption(option)}
                onClick={() => {
                  selectOption(option);
                  window.setTimeout(() => setIsOpen(false), 220);
                }}
              >
                {option}
              </button>
            );
          })}
          {toastText && <div className="ltks-select-toast">{toastText}</div>}
        </div>
      )}
    </div>
  );
};

interface PdfReviewTabsProps {
  tabs: ReviewTab[];
  activeIndex: number;
  onTabChange: (index: number) => void;
}

const PdfReviewTabs: React.FC<PdfReviewTabsProps> = ({ tabs, activeIndex, onTabChange }) => {
  const activeTab = tabs[activeIndex] ?? tabs[0];

  return (
    <div className="ltks-pdf-review">
      <div className="ltks-pdf-tabs" role="tablist" aria-label="Danh sách tờ khai">
        {tabs.map((tab, index) => (
          <button
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            className={index === activeIndex ? 'active' : ''}
            key={tab.title}
            onClick={() => onTabChange(index)}
          >
            {tab.title}
          </button>
        ))}
      </div>

      <div className="ltks-pdf-panel" role="tabpanel" aria-label={activeTab.title}>
        <div className="ltks-pdf-toolbar">
          <div className="ltks-pdf-toolbar-group">
            <button type="button" aria-label="Mở danh mục">
              <Menu size={20} />
            </button>
            <strong>{activeTab.title}</strong>
          </div>
          <div className="ltks-pdf-toolbar-group center">
            <span>1 / {activeTab.pageCount}</span>
            <span className="ltks-pdf-divider" />
            <button type="button" aria-label="Thu nhỏ">
              <Minus size={18} />
            </button>
            <span>100%</span>
            <button type="button" aria-label="Phóng to">
              <Plus size={18} />
            </button>
            <span className="ltks-pdf-divider" />
            <button type="button" aria-label="Xoay trang">
              <RotateCw size={18} />
            </button>
          </div>
          <div className="ltks-pdf-toolbar-group">
            <button type="button" aria-label="In tờ khai">
              <Printer size={18} />
            </button>
            <a href={activeTab.url} download title="Tải tờ khai" aria-label="Tải tờ khai">
              <Download size={18} />
            </a>
            <button type="button" aria-label="Thêm tùy chọn">
              <MoreVertical size={18} />
            </button>
          </div>
        </div>
        <div className="ltks-pdf-canvas">
          <article className="ltks-pdf-sheet">
            <header className="ltks-pdf-sheet-header">
              <h3>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h3>
              <p>Độc lập - Tự do - Hạnh phúc</p>
              <h2>{activeTab.formTitle}</h2>
              <span>Kính gửi: {activeTab.recipient}</span>
            </header>

            <div className="ltks-pdf-sheet-body">
              <p className="ltks-pdf-lead">{activeTab.description}</p>
              <div className="ltks-pdf-row">
                <strong>Họ, chữ đệm, tên người yêu cầu:</strong>
                <span>TRẦN MINH HÙNG</span>
              </div>
              <div className="ltks-pdf-row">
                <strong>Số định danh cá nhân:</strong>
                <span>093206008464</span>
              </div>
              <div className="ltks-pdf-row">
                <strong>Ngày sinh:</strong>
                <span>23/02/2006</span>
              </div>
              <div className="ltks-pdf-row">
                <strong>Nơi cư trú:</strong>
                <span>Phường Cái Khế, Thành phố Cần Thơ</span>
              </div>
              <div className="ltks-pdf-row">
                <strong>Người được khai sinh:</strong>
                <span>[Thông tin trẻ được hệ thống tổng hợp từ bước kê khai]</span>
              </div>
              <div className="ltks-pdf-row">
                <strong>Cơ quan thực hiện:</strong>
                <span>Cơ quan X</span>
              </div>
              <p>
                Tôi cam đoan những nội dung khai trên là đúng sự thật và chịu trách nhiệm trước pháp luật về
                cam đoan của mình.
              </p>
              <div className="ltks-pdf-signature">
                <span>Ngày ...... tháng ...... năm ......</span>
                <strong>Người yêu cầu</strong>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
};

const ReviewPanel: React.FC<{ values: Record<string, string> }> = ({ values }) => {
  const babyName = [values.ltks_hoTre, values.ltks_chuDemTre, values.ltks_tenTre].filter(Boolean).join(' ') || 'Chưa nhập';
  const requester = values.ltks_hoTenNguoiYeuCau || 'Chưa nhập';

  return (
    <div className="ltks-review">
      <div><strong>Tên thủ tục</strong><span>Liên thông đăng ký khai sinh, đăng ký thường trú, cấp thẻ BHYT cho trẻ dưới 6 tuổi</span></div>
      <div><strong>Người yêu cầu</strong><span>{requester}</span></div>
      <div><strong>Người được khai sinh</strong><span>{babyName}</span></div>
      <div><strong>Ngày nộp hồ sơ</strong><span>--/--/----</span></div>
      <div><strong>Mã hồ sơ</strong><span>Hồ sơ sẽ được sinh sau khi gửi</span></div>
      <p>Vui lòng ghi nhớ các thông tin bên dưới để theo dõi tình hình xử lý hoặc cập nhật thông tin hồ sơ của bạn.</p>
    </div>
  );
};

export default LienThongKhaiSinhPage;
