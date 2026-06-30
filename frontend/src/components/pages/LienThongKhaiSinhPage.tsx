import React from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Download, Menu, Minus, MoreVertical, Paperclip, Plus, Printer, RotateCw } from 'lucide-react';
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
  uploads?: UploadDocument[];
  resultOptions?: boolean;
  complete?: boolean;
  review?: boolean;
  hideTitle?: boolean;
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

interface UploadDocument {
  title: string;
  copies: number;
  required?: boolean;
  templateUrl?: string;
}

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
  'Con về với cha, mẹ; cha, mẹ là chủ sở hữu chỗ ở hợp pháp',
  'Con về với cha, mẹ; cha, mẹ không là chủ sở hữu chỗ ở hợp pháp',
  'Trẻ em mới sinh về với người giám hộ',
  'Trẻ em về với người thân khác',
  'Đăng ký thường trú tại cơ sở tín ngưỡng, cơ sở tôn giáo',
  'Đăng ký thường trú tại cơ sở trợ giúp xã hội hoặc hộ gia đình nhận chăm sóc, nuôi dưỡng, trợ giúp',
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
const legalOwnerOptions = ['Chủ hộ là chủ sở hữu chỗ ở hợp pháp', 'Cha/mẹ là chủ sở hữu chỗ ở hợp pháp', 'Người giám hộ là chủ sở hữu chỗ ở hợp pháp', 'Người thân khác là chủ sở hữu chỗ ở hợp pháp'];
const confirmerRelationOptions = ['Chủ hộ', 'Chủ sở hữu chỗ ở hợp pháp', 'Cha', 'Mẹ', 'Người giám hộ', 'Người thân khác'];
const guardianOptions = ['Thông tin cha', 'Thông tin mẹ', 'Thông tin người yêu cầu'];
const healthcareOptions = ['Trạm y tế phường/xã', 'Bệnh viện đa khoa khu vực', 'Bệnh viện tuyến huyện'];
const receiveResultOptions = [
  'Qua cổng thông tin',
  'Đến cơ quan giải quyết để nhận kết quả.',
  'Tại nơi nhận kết quả khai sinh (UBND)',
];
const defaultBirthReceiveResult = 'Đến cơ quan giải quyết để nhận kết quả';
const defaultResidenceReceiveResult = 'Qua cổng thông tin';
const defaultBhytReceiveResult = 'Chỉ nhận bản điện tử của thẻ BHYT trên Cổng DVCQG';
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
          { id: 'ltks_tinhKhaiSinh', label: 'Tỉnh/Thành phố', type: 'select', required: true, options: provinceOptions, value: 'Thành phố Cần Thơ' },
          { id: 'ltks_phuongKhaiSinh', label: 'Phường/Xã', type: 'select', required: true, options: wardOptions, value: 'Phường Cái Khế' },
          { id: 'ltks_coQuanDangKyKhaiSinh', label: 'Cơ quan thực hiện', type: 'text', required: true, wide: true, dotted: true, readOnly: true, value: 'Cơ quan X' },
          { id: 'ltks_truongHopKhaiSinh', label: 'Trường hợp khai sinh', type: 'select', required: true, wide: true, options: birthCaseOptions },
        ],
      },
      {
        title: 'Cơ quan thực hiện đăng ký thường trú',
        sameArea: true,
        fields: [
          { id: 'ltks_tinhThuongTru', label: 'Tỉnh/Thành phố', type: 'select', required: true, options: provinceOptions, value: 'Thành phố Cần Thơ' },
          { id: 'ltks_phuongThuongTru', label: 'Phường/Xã', type: 'select', required: true, options: wardOptions, value: 'Phường Cái Khế' },
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
          { id: 'ltks_hoTenNguoiYeuCau', label: 'Họ, chữ đệm, tên người yêu cầu', type: 'text', required: true, span: 3 },
          { id: 'ltks_soDinhDanhNguoiYeuCau', label: 'Số định danh', type: 'text', required: true, span: 3 },
          { id: 'ltks_ngaySinhNguoiYeuCau', label: 'Ngày sinh người yêu cầu', type: 'date', required: true, span: 3 },
          { id: 'ltks_gioiTinhNguoiYeuCau', label: 'Giới tính', type: 'select', required: true, span: 3, options: genderOptions },
          { id: 'ltks_ngayCapNguoiYeuCau', label: 'Ngày cấp', type: 'date', required: true, span: 6 },
          { id: 'ltks_noiCapNguoiYeuCau', label: 'Nơi cấp', type: 'text', required: true, span: 6 },
          { id: 'ltks_loaiCuTruNguoiYeuCau', label: 'Loại cư trú', type: 'select', required: true, span: 6, options: residenceTypeOptions },
          { id: 'ltks_quocGiaNguoiYeuCau', label: 'Quốc gia', type: 'select', required: true, span: 6, options: countryOptions, value: 'Cộng hòa XHCN Việt Nam' },
          { id: 'ltks_tinhNguoiYeuCau', label: 'Tỉnh/Thành phố', type: 'select', required: true, span: 6, options: provinceOptions },
          { id: 'ltks_phuongNguoiYeuCau', label: 'Phường/Xã', type: 'select', required: true, span: 6, options: wardOptions },
          { id: 'ltks_chiTietNguoiYeuCau', label: 'Chi tiết', type: 'text', required: true, wide: true },
          { id: 'ltks_quanHeVoiTre', label: 'Quan hệ với người được khai sinh', type: 'select', required: true, span: 3, options: requesterRelationOptions },
          { id: 'ltks_quanHeVoiTreKhac', label: 'Quan hệ với người được khai sinh (khác)', type: 'text', span: 3 },
          { id: 'ltks_sdtNguoiYeuCau', label: 'Số điện thoại', type: 'text', required: true, span: 3 },
          { id: 'ltks_emailNguoiYeuCau', label: 'Email', type: 'text', span: 3 },
        ],
      },
      {
        title: 'Thông tin người được khai sinh',
        note: 'Ghi chú về kê khai họ tên: Ghi đầy đủ và chính xác họ, chữ đệm, tên của người được khai sinh theo giấy tờ tùy thân (nếu có).',
        fields: [
          { id: 'ltks_nhapThongTinTre', label: 'Phương thức nhập', type: 'radio', required: true, wide: true, hideLabel: true, options: ['Nhập tay', 'Lấy dữ liệu chứng sinh từ CSDL Bảo hiểm'], value: 'Nhập tay' },
          { id: 'ltks_maGiayChungSinh', label: 'Mã giấy chứng sinh', type: 'text', span: 6 },
          { id: 'ltks_cccdMeGiayChungSinh', label: 'CCCD/CMND mẹ', type: 'text', span: 6 },
          { id: 'ltks_hoTre', label: 'Họ người được khai sinh', type: 'text', span: 4 },
          { id: 'ltks_chuDemTre', label: 'Chữ đệm người được khai sinh', type: 'text', span: 4 },
          { id: 'ltks_tenTre', label: 'Tên người được khai sinh', type: 'text', required: true, span: 4 },
          { id: 'ltks_ngaySinhTre', label: 'Ngày tháng năm sinh', type: 'date', required: true, span: 4 },
          { id: 'ltks_ngaySinhBangChu', label: 'Ghi bằng chữ', type: 'text', required: true, span: 8 },
          { id: 'ltks_quocGiaNoiSinh', label: 'Quốc gia', type: 'select', required: true, span: 4, options: countryOptions, value: 'Cộng hòa XHCN Việt Nam' },
          { id: 'ltks_tinhNoiSinh', label: 'Tỉnh/Thành phố', type: 'select', required: true, span: 4, options: provinceOptions },
          { id: 'ltks_phuongNoiSinh', label: 'Phường/Xã', type: 'select', required: true, span: 4, options: wardOptions },
          { id: 'ltks_chiTietNoiSinh', label: 'Chi tiết', type: 'text', wide: true },
          { id: 'ltks_gioiTinhTre', label: 'Giới tính', type: 'select', required: true, span: 4, options: genderOptions },
          { id: 'ltks_quocTichTre', label: 'Quốc tịch', type: 'select', required: true, span: 4, options: nationalityOptions, value: 'Việt Nam' },
          { id: 'ltks_danTocTre', label: 'Dân tộc', type: 'select', required: true, span: 4, options: ethnicityOptions, value: 'Kinh' },
          { id: 'ltks_danTocKhacTre', label: 'Dân tộc khác', type: 'text', span: 4 },
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
        note: 'Ghi chú về kê khai họ tên: Ghi đầy đủ và chính xác họ, chữ đệm, tên người mẹ của người được khai sinh theo giấy tờ tùy thân (nếu có).',
        actions: ['Xác thực với CSDLQG về dân cư', 'Nhập lại'],
        fields: [
          { id: 'ltks_quocTichMe', label: 'Quốc tịch', type: 'select', required: true, span: 6, options: nationalityOptions, value: 'Việt Nam' },
          { id: 'ltks_danTocMe', label: 'Dân tộc', type: 'select', required: true, span: 6, options: ethnicityOptions, value: 'Kinh' },
          { id: 'ltks_hoMe', label: 'Họ mẹ', type: 'text', span: 4 },
          { id: 'ltks_chuDemMe', label: 'Chữ đệm mẹ', type: 'text', span: 4 },
          { id: 'ltks_tenMe', label: 'Tên mẹ', type: 'text', required: true, span: 4 },
          { id: 'ltks_ngaySinhMe', label: 'Ngày tháng năm sinh', type: 'date', span: 6 },
          { id: 'ltks_soDinhDanhMe', label: 'Số định danh', type: 'text', required: true, span: 6 },
          { id: 'ltks_soHoChieuMe', label: 'Số hộ chiếu', type: 'text', span: 4 },
          { id: 'ltks_ngayCapHoChieuMe', label: 'Ngày cấp hộ chiếu', type: 'date', span: 4 },
          { id: 'ltks_noiCapHoChieuMe', label: 'Nơi cấp hộ chiếu', type: 'text', span: 4 },
          { id: 'ltks_loaiCuTruMe', label: 'Loại cư trú', type: 'select', required: true, span: 6, options: residenceTypeOptions },
          { id: 'ltks_quocGiaMe', label: 'Quốc gia', type: 'select', required: true, span: 6, options: countryOptions, value: 'Cộng hòa XHCN Việt Nam' },
          { id: 'ltks_tinhMe', label: 'Tỉnh/Thành phố', type: 'select', required: true, span: 6, options: provinceOptions },
          { id: 'ltks_phuongMe', label: 'Phường/Xã', type: 'select', required: true, span: 6, options: wardOptions },
          { id: 'ltks_chiTietMe', label: 'Chi tiết', type: 'text', wide: true },
        ],
      },
      {
        title: 'Thông tin người cha đẻ/nhờ mang thai hộ',
        note: 'Ghi chú về kê khai họ tên: Ghi đầy đủ và chính xác họ, chữ đệm, tên người cha của người được khai sinh theo giấy tờ tùy thân (nếu có).',
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
          { id: 'ltks_soHoChieuCha', label: 'Số hộ chiếu', type: 'text', span: 4 },
          { id: 'ltks_ngayCapHoChieuCha', label: 'Ngày cấp hộ chiếu', type: 'date', span: 4 },
          { id: 'ltks_noiCapHoChieuCha', label: 'Nơi cấp hộ chiếu', type: 'text', span: 4 },
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
              'Xin xác nhận của chủ hộ, chủ sở hữu chỗ ở hợp pháp, cha/mẹ/người giám hộ về việc đăng ký thường trú cho trẻ qua VNEID (Chú ý: Chủ hộ, Chủ sở hữu chỗ ở hợp pháp, Cha/mẹ/người giám hộ phải có tài khoản VNEID mức độ 2 đang hoạt động).',
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
          { id: 'ltks_loaiChuSoHuuChoO', label: 'Loại chủ sở hữu chỗ ở hợp pháp', type: 'select', span: 6, options: legalOwnerOptions },
          { id: 'ltks_loaiThanNhanXacNhan', label: 'Loại thân nhân xác nhận', type: 'select', span: 6, options: confirmerRelationOptions },
          { id: 'ltks_hoTenNguoiXacNhan', label: 'Họ, chữ đệm, tên người xác nhận', type: 'text', span: 6 },
          { id: 'ltks_soDinhDanhNguoiXacNhan', label: 'Số định danh người xác nhận', type: 'text', span: 6 },
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
        hideTitle: true,
        uploads: [
          {
            title: 'Bản chụp Giấy chứng sinh, Trường hợp không có Giấy chứng sinh thì đăng tải bản chụp văn bản của người làm chứng xác nhận về việc sinh, ; Nếu không có người làm chứng thì phải có bản chụp giấy cam đoan về việc sinh. Khi đến cơ quan đăng ký hộ tịch nhận kết quả (Giấy khai sinh/bản sao Giấy khai sinh), công dân phải nộp bản chính Giấy chứng sinh',
            copies: 1,
            required: true,
          },
          {
            title: 'Tờ khai thay đổi thông tin cư trú (trường hợp trẻ còn bố, mẹ, người giám hộ thì phải có ý kiến đồng ý khi trẻ không ở cùng bố, mẹ, người giám hộ). Tờ khai cần có đầy đủ ý kiến, chữ ký của các thành phần tham gia trong mẫu',
            copies: 1,
            required: true,
            templateUrl: '/lien-thong-khai-sinh/tokhai_cutru.pdf',
          },
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
        hideTitle: true,
        resultOptions: true,
      },
    ],
  },
  {
    title: 'Hoàn thành',
    shortTitle: 'Hoàn thành',
    sections: [
      { title: 'Hoàn thành nộp hồ sơ', complete: true, hideTitle: true },
    ],
  },
];

const parseStep = (stepSlug?: string) => {
  const match = stepSlug?.match(/^buoc-(\d+)$/);
  const step = match ? Number(match[1]) : 1;
  return Math.min(Math.max(step, 1), steps.length);
};

const LienThongKhaiSinhPage: React.FC = () => {
  const navigate = useNavigate();
  const { stepSlug } = useParams();
  const { formState, setFieldValue, setFieldError, touchField, resetForm } = useForm();
  const [submitError, setSubmitError] = React.useState('');
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
                {!section.reviewTabs && !section.hideTitle && (
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
                  <UploadDocumentsTable uploads={section.uploads} />
                )}
                {section.resultOptions && (
                  <ResultOptionsPanel
                    values={formState.values}
                    onChange={(fieldId, value) => setFieldValue(fieldId, value)}
                  />
                )}
                {section.complete && (
                  <CompletePanel onReset={() => goToStep(1)} />
                )}
                {section.review && <ReviewPanel values={formState.values} />}
              </section>
            ))}
          </div>

          {submitError && <div className="ltks-alert error">{submitError}</div>}

          {currentStep < steps.length && (
            <div className="ltks-actions">
              <button type="button" className="ltks-btn ghost" onClick={() => { resetForm(); navigate('/'); }}>
                Hủy
              </button>
              {currentStep > 1 && (
                <button type="button" className="ltks-btn secondary" onClick={() => goToStep(currentStep - 1)}>
                  Quay lại bước trước
                </button>
              )}
              <button type="button" className="ltks-btn primary" onClick={handleNext}>
                {currentStep === 5 ? 'Hoàn thành' : 'Chuyển bước tiếp theo'}
              </button>
              {currentStep === 5 && (
                <button type="button" className="ltks-btn secondary">
                  Lưu nháp
                </button>
              )}
            </div>
          )}
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

interface ResultOptionsPanelProps {
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
}

const ResultOptionsPanel: React.FC<ResultOptionsPanelProps> = ({ values, onChange }) => {
  const birthReceiveValue = values.ltks_nhanKhaiSinh || defaultBirthReceiveResult;
  const residenceReceiveValue = values.ltks_nhanThuongTru || defaultResidenceReceiveResult;
  const paperBhytChecked = values.ltks_nhanBhytBanGiay === 'true';
  const pledgeChecked = values.ltks_camDoanKetQua === 'true';

  React.useEffect(() => {
    if (!values.ltks_nhanKhaiSinh) onChange('ltks_nhanKhaiSinh', defaultBirthReceiveResult);
    if (!values.ltks_nhanThuongTru) onChange('ltks_nhanThuongTru', defaultResidenceReceiveResult);
    if (!values.ltks_nhanTheBhyt) onChange('ltks_nhanTheBhyt', defaultBhytReceiveResult);
  }, [onChange, values.ltks_nhanKhaiSinh, values.ltks_nhanTheBhyt, values.ltks_nhanThuongTru]);

  return (
    <div className="ltks-result-options">
      <div className="ltks-result-line compact">
        <label htmlFor="ltks_nhanKhaiSinh">Hình thức nhận kết quả khai sinh</label>
        <input
          id="ltks_nhanKhaiSinh"
          value={birthReceiveValue}
          readOnly
          aria-label="Hình thức nhận kết quả khai sinh"
        />
      </div>

      <div className="ltks-result-field">
        <label htmlFor="ltks_noiTraKetQua" className="required">Nơi trả kết quả</label>
        <input
          id="ltks_noiTraKetQua"
          value={values.ltks_noiTraKetQua || ''}
          readOnly
          placeholder="Nơi trả kết quả"
          aria-label="Nơi trả kết quả"
          onChange={(event) => onChange('ltks_noiTraKetQua', event.target.value)}
        />
      </div>

      <div className="ltks-result-line">
        <label>Hình thức nhận kết quả đăng ký thường trú</label>
        <CustomSelect
          id="ltks_nhanThuongTru"
          label="Hình thức nhận kết quả đăng ký thường trú"
          value={residenceReceiveValue}
          options={receiveResultOptions}
          placeholder=""
          onChange={(value) => onChange('ltks_nhanThuongTru', value)}
        />
      </div>

      <div className="ltks-result-line checkbox-line">
        <span>Hình thức nhận thẻ BHYT</span>
        <label className="ltks-material-check disabled">
          <input type="checkbox" checked readOnly disabled />
          <span />
          {defaultBhytReceiveResult}
        </label>
      </div>

      <label className="ltks-material-check paper-check">
        <input
          type="checkbox"
          checked={paperBhytChecked}
          onChange={(event) => onChange('ltks_nhanBhytBanGiay', event.target.checked ? 'true' : '')}
        />
        <span />
        Bản giấy
      </label>

      <div className="ltks-captcha-row">
        <div className="ltks-result-field">
          <label htmlFor="ltks_captcha" className="required">Nhập mã kiếm tra</label>
          <input
            id="ltks_captcha"
            value={values.ltks_captcha || ''}
            aria-label="Nhập mã kiếm tra"
            onChange={(event) => onChange('ltks_captcha', event.target.value)}
          />
        </div>
        <div className="ltks-captcha-box" aria-label="Mã kiểm tra">
          <div className="ltks-captcha-image">7K3P9</div>
          <button type="button" aria-label="Làm mới mã kiểm tra">
            <RotateCw size={22} />
          </button>
        </div>
      </div>

      <label className="ltks-material-check pledge-check">
        <input
          type="checkbox"
          checked={pledgeChecked}
          onChange={(event) => onChange('ltks_camDoanKetQua', event.target.checked ? 'true' : '')}
        />
        <span />
        Tôi cam đoan nội dung đề nghị trên đấy là đúng sự thật, được sự thỏa thuận nhất trí của các bên liên quan theo quy định pháp luật. Tôi chịu hoàn toàn trách nhiệm trước pháp luật về nội dung cam đoan của mình.
      </label>
      <span className="ltks-result-line-end" />
    </div>
  );
};

const UploadDocumentsTable: React.FC<{ uploads: UploadDocument[] }> = ({ uploads }) => (
  <div className="ltks-upload-table-wrap">
    <table className="ltks-upload-table">
      <thead>
        <tr>
          <th className="stt">STT</th>
          <th>Tên giấy tờ</th>
          <th className="copies">Số bản</th>
          <th className="file">Tệp tin</th>
          <th className="template">Mẫu đơn</th>
        </tr>
      </thead>
      <tbody>
        {uploads.map((upload, index) => (
          <tr key={upload.title}>
            <td className="stt">{index + 1}</td>
            <td className="document-name">
              <span>{upload.title}</span>
              {upload.required && <span className="required"> (Bắt buộc)</span>}
            </td>
            <td className="copies">{upload.copies}</td>
            <td className="file">
              <button type="button" className="ltks-file-button">
                <Paperclip size={20} />
                Chọn tệp tin
              </button>
            </td>
            <td className="template">
              {upload.templateUrl && (
                <a href={upload.templateUrl} download>
                  Tải mẫu
                </a>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const PdfReviewTabs: React.FC<PdfReviewTabsProps> = ({ tabs, activeIndex, onTabChange }) => {
  const activeTab = tabs[activeIndex] ?? tabs[0];
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [isTabListVisible, setIsTabListVisible] = React.useState(true);
  const [zoom, setZoom] = React.useState(100);
  const [rotation, setRotation] = React.useState(0);

  React.useEffect(() => {
    setZoom(100);
    setRotation(0);
  }, [activeTab.url]);

  const handlePrint = () => {
    const printWindow = window.open(activeTab.url, '_blank');
    if (printWindow) {
      window.setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 700);
      return;
    }

    iframeRef.current?.contentWindow?.focus();
    iframeRef.current?.contentWindow?.print();
  };

  const handleZoomOut = () => setZoom((currentZoom) => Math.max(50, currentZoom - 10));
  const handleZoomIn = () => setZoom((currentZoom) => Math.min(200, currentZoom + 10));
  const handleRotate = () => setRotation((currentRotation) => (currentRotation + 90) % 360);

  return (
    <div className="ltks-pdf-review">
      {isTabListVisible && (
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
      )}

      <div className="ltks-pdf-panel" role="tabpanel" aria-label={activeTab.title}>
        <div className="ltks-pdf-toolbar">
          <div className="ltks-pdf-toolbar-group">
            <button
              type="button"
              aria-label={isTabListVisible ? 'Ẩn danh mục tờ khai' : 'Mở danh mục tờ khai'}
              title={isTabListVisible ? 'Ẩn danh mục tờ khai' : 'Mở danh mục tờ khai'}
              onClick={() => setIsTabListVisible((isVisible) => !isVisible)}
            >
              <Menu size={20} />
            </button>
            <strong>{activeTab.title}</strong>
          </div>
          <div className="ltks-pdf-toolbar-group center">
            <span>1 / {activeTab.pageCount}</span>
            <span className="ltks-pdf-divider" />
            <button type="button" aria-label="Thu nhỏ" title="Thu nhỏ" onClick={handleZoomOut}>
              <Minus size={18} />
            </button>
            <span>{zoom}%</span>
            <button type="button" aria-label="Phóng to" title="Phóng to" onClick={handleZoomIn}>
              <Plus size={18} />
            </button>
            <span className="ltks-pdf-divider" />
            <button type="button" aria-label="Xoay trang" title="Xoay trang" onClick={handleRotate}>
              <RotateCw size={18} />
            </button>
          </div>
          <div className="ltks-pdf-toolbar-group">
            <button type="button" aria-label="In tờ khai" title="In tờ khai" onClick={handlePrint}>
              <Printer size={18} />
            </button>
            <a href={activeTab.url} download title="Tải tờ khai" aria-label="Tải tờ khai">
              <Download size={18} />
            </a>
            <button
              type="button"
              aria-label="Mở tờ khai trong tab mới"
              title="Mở tờ khai trong tab mới"
              onClick={() => window.open(activeTab.url, '_blank', 'noopener,noreferrer')}
            >
              <MoreVertical size={18} />
            </button>
          </div>
        </div>
        <div className="ltks-pdf-canvas">
          <div
            className="ltks-pdf-frame-shell"
            style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)` }}
          >
            <iframe
              ref={iframeRef}
              key={activeTab.url}
              className="ltks-pdf-frame"
              src={`${activeTab.url}#toolbar=0&navpanes=0&view=FitH`}
              title={activeTab.title}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const CompletePanel: React.FC<{ onReset: () => void }> = ({ onReset }) => {
  const [showToast, setShowToast] = React.useState(true);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setShowToast(false), 3500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="ltks-complete-card">
      {showToast && (
        <div className="ltks-complete-toast">
          <span>✓</span>
          Kê khai thành công!
        </div>
      )}

      <div className="ltks-complete-title">
        <h2>BƯỚC 6: HOÀN THÀNH NỘP HỒ SƠ</h2>
      </div>

      <div className="ltks-complete-content">
        <div className="ltks-complete-watermark" />
        <div className="ltks-complete-inner">
          <p className="ltks-complete-note">
            Vui lòng ghi nhớ các thông tin bên dưới để theo dõi tình hình xử lý hoặc cập nhật thông tin hồ sơ của bạn.
          </p>
          <p className="ltks-complete-code">Số hồ sơ: G22.99.09-240114-0001</p>

          <div className="ltks-complete-copy">
            <p>
              Thời gian giải quyết của <strong>hồ sơ liên thông</strong> là không quá <strong>03 ngày làm việc</strong> kể từ khi cán bộ tiếp nhận hồ sơ.
            </p>
            <p>Cụ thể:</p>
            <ul>
              <li>Hồ sơ đăng ký khai sinh: 01 ngày làm việc kể từ khi cán bộ tiếp nhận hồ sơ.</li>
              <li>Hồ sơ đăng ký thường trú: 02 ngày làm việc kể từ khi cán bộ tiếp nhận hồ sơ.</li>
              <li>Hồ sơ cấp thẻ bảo hiểm y tế cho trẻ dưới 6 tuổi: được chuyển xử lý theo dữ liệu liên thông đã kê khai.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="ltks-complete-actions">
        <button type="button" className="ltks-btn secondary" onClick={onReset}>
          Về trang chủ
        </button>
        <button type="button" className="ltks-btn primary">
          In Biên Lai
        </button>
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
