import { dossierCases } from '../data/tamTruMockData';

export type TamTruReviewStatus = 'VALID' | 'NEED_REVIEW' | 'INVALID';

export interface TamTruHouseholdMember {
    id: number;
    fullName: string;
    dateFormat: string;
    dateOfBirth: string;
    gender: string;
    citizenId: string;
    relationshipWithHead: string;
}

export interface TamTruAttachmentDraft {
    documentId: string;
    checked: boolean;
    fileName: string;
    quantity: string;
    note: string;
}

export interface TamTruApplicationData {
    receiveCityCode: string;
    receiveVillageCode: string;
    receiveOrgAddress: string;
    receiveOrgPhone: string;
    procedureTypeCode: string;
    procedureCaseCode: string;
    registrationMode: string;
    declareMode: string;
    fullName: string;
    dateFormat: string;
    dateOfBirth: string;
    gender: string;
    ethnicity: string;
    religion: string;
    citizenId: string;
    phoneNumber: string;
    email: string;
    temporaryCityCode: string;
    temporaryVillageCode: string;
    temporaryAddress: string;
    householderName: string;
    householderCitizenId: string;
    householderRelationship: string;
    requestContent: string;
    temporaryUntilDate: string;
    householdMembers: TamTruHouseholdMember[];
    selectedDossierCaseId: string;
    attachmentDrafts: Record<string, TamTruAttachmentDraft>;
    notificationMethod: string;
    resultMethod: string;
    feeType: string;
    feeAmount: string;
    feeExemptionReason: string;
    feeDescription: string;
    committed: boolean;
}

export interface TamTruReviewItem {
    title: string;
    reason: string;
    suggestion: string;
}

export interface TamTruReviewResult {
    status: TamTruReviewStatus;
    riskScore: number;
    errors: TamTruReviewItem[];
    warnings: TamTruReviewItem[];
    suggestions: string[];
}

const addItem = (
    list: TamTruReviewItem[],
    title: string,
    reason: string,
    suggestion: string,
) => {
    list.push({ title, reason, suggestion });
};

const isVietnamesePhone = (value: string) => /^(0|\+84)(3|5|7|8|9)\d{8}$/.test(value.replace(/\s/g, ''));
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isCitizenId = (value: string) => /^\d{12}$/.test(value);

const toDate = (value: string) => {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`);
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    return new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00`);
};

const hasMemberData = (member: TamTruHouseholdMember) => (
    Boolean(
        member.fullName.trim()
        || member.dateOfBirth.trim()
        || member.gender.trim()
        || member.citizenId.trim()
        || member.relationshipWithHead.trim(),
    )
);

export const validateTamTruApplication = (formData: TamTruApplicationData): TamTruReviewResult => {
    const errors: TamTruReviewItem[] = [];
    const warnings: TamTruReviewItem[] = [];
    const suggestions: string[] = [];

    const requireField = (value: string | boolean, title: string, reason: string, suggestion: string) => {
        if (typeof value === 'boolean' ? !value : !value.trim()) addItem(errors, title, reason, suggestion);
    };

    requireField(formData.receiveCityCode, 'Thiếu Tỉnh/Thành phố cơ quan thực hiện', 'Chưa chọn địa bàn tiếp nhận hồ sơ.', 'Chọn Tỉnh/Thành phố ở phần Cơ quan thực hiện.');
    requireField(formData.receiveVillageCode, 'Thiếu Xã/Phường/Đặc khu cơ quan thực hiện', 'Chưa chọn đơn vị hành chính cấp xã.', 'Chọn Xã/Phường/Đặc khu theo Tỉnh/Thành phố đã chọn.');
    requireField(formData.receiveOrgAddress, 'Thiếu Cơ quan thực hiện', 'Chưa xác định cơ quan tiếp nhận.', 'Chọn đủ Tỉnh/Thành phố và Xã/Phường để hệ thống tự điền.');
    requireField(formData.procedureTypeCode, 'Thiếu Thủ tục', 'Chưa chọn loại thủ tục hành chính.', 'Chọn thủ tục phù hợp với nhu cầu tạm trú.');
    requireField(formData.procedureCaseCode, 'Thiếu Trường hợp', 'Chưa chọn trường hợp xử lý.', 'Chọn trường hợp tương ứng với thủ tục.');
    requireField(formData.fullName, 'Thiếu Họ và tên', 'Chưa nhập họ tên người đề nghị.', 'Nhập họ tên đầy đủ theo giấy tờ tùy thân.');
    requireField(formData.dateFormat, 'Thiếu định dạng ngày sinh', 'Chưa chọn định dạng ngày sinh.', 'Chọn ngày tháng năm, tháng năm hoặc năm.');
    requireField(formData.dateOfBirth, 'Thiếu Ngày sinh', 'Chưa nhập ngày tháng năm sinh.', 'Nhập ngày sinh theo định dạng đã chọn.');
    requireField(formData.gender, 'Thiếu Giới tính', 'Chưa chọn giới tính.', 'Chọn Nam, Nữ hoặc Khác.');
    requireField(formData.temporaryCityCode, 'Thiếu Tỉnh/Thành phố nơi tạm trú', 'Chưa chọn địa bàn nơi tạm trú.', 'Chọn Tỉnh/Thành phố nơi người dân dự kiến tạm trú.');
    requireField(formData.temporaryVillageCode, 'Thiếu Xã/Phường nơi tạm trú', 'Chưa chọn cấp xã nơi tạm trú.', 'Chọn Xã/Phường/Đặc khu nơi tạm trú.');
    requireField(formData.temporaryAddress, 'Thiếu địa chỉ chi tiết nơi tạm trú', 'Chưa nhập số nhà, đường hoặc mô tả chỗ ở.', 'Bổ sung địa chỉ chi tiết để cán bộ dễ kiểm tra.');
    requireField(formData.householderName, 'Thiếu họ tên chủ hộ', 'Chưa nhập họ tên chủ hộ tạm trú.', 'Nhập họ tên chủ hộ tạm trú.');
    requireField(formData.householderRelationship, 'Thiếu quan hệ với chủ hộ', 'Chưa chọn quan hệ với chủ hộ.', 'Chọn quan hệ phù hợp trong danh sách.');
    requireField(formData.householderCitizenId, 'Thiếu số ĐDCN chủ hộ', 'Chưa nhập số định danh cá nhân chủ hộ.', 'Nhập đủ 12 chữ số định danh của chủ hộ.');
    requireField(formData.requestContent, 'Thiếu nội dung đề nghị', 'Chưa nhập nội dung đề nghị đăng ký tạm trú.', 'Bổ sung nội dung đề nghị theo địa bàn tạm trú.');
    requireField(formData.temporaryUntilDate, 'Thiếu thời hạn tạm trú đến ngày', 'Chưa nhập ngày kết thúc thời hạn đề nghị.', 'Chọn ngày đến hạn tạm trú.');
    requireField(formData.resultMethod, 'Thiếu hình thức nhận kết quả', 'Chưa chọn cách nhận kết quả giải quyết hồ sơ.', 'Chọn nhận trực tiếp, bưu chính hoặc trực tuyến.');
    requireField(formData.committed, 'Chưa xác nhận cam kết', 'Người khai chưa tick xác nhận chịu trách nhiệm.', 'Tick ô cam kết trước khi nộp hồ sơ.');

    if (!isCitizenId(formData.citizenId)) {
        addItem(errors, 'Số định danh cá nhân chưa hợp lệ', 'Số định danh phải gồm đúng 12 chữ số.', 'Kiểm tra lại CCCD/định danh cá nhân và nhập đủ 12 chữ số.');
    }

    if (formData.householderCitizenId && !isCitizenId(formData.householderCitizenId)) {
        addItem(errors, 'Số giấy tờ chủ hộ chưa hợp lệ', 'Số định danh chủ hộ phải gồm đúng 12 chữ số.', 'Kiểm tra lại số định danh cá nhân của chủ hộ.');
    }

    if (formData.phoneNumber && !isVietnamesePhone(formData.phoneNumber)) {
        addItem(warnings, 'Số điện thoại cần kiểm tra', 'Số điện thoại chưa giống định dạng di động Việt Nam.', 'Nên nhập số bắt đầu bằng 0 hoặc +84 và có 10 chữ số.');
    }

    if (formData.email && !isEmail(formData.email)) {
        addItem(warnings, 'Email cần kiểm tra', 'Email chưa đúng định dạng thông thường.', 'Bổ sung email dạng ten@example.com hoặc để trống nếu không dùng.');
    }

    const untilDate = toDate(formData.temporaryUntilDate);
    if (untilDate) {
        const now = new Date();
        const days = (untilDate.getTime() - now.getTime()) / 86400000;
        if (days > 731) {
            addItem(warnings, 'Thời hạn tạm trú vượt quá 2 năm', 'Ngày đến hạn đang xa hơn mốc 24 tháng.', 'Điều chỉnh thời hạn hoặc chuẩn bị căn cứ chứng minh.');
        }
    }

    formData.householdMembers.forEach((member, index) => {
        if (!hasMemberData(member)) return;
        const prefix = `Thành viên dòng ${index + 1}`;
        requireField(member.fullName, `${prefix}: thiếu họ và tên`, 'Dòng thành viên đã nhập một phần nhưng chưa đủ họ tên.', 'Nhập họ tên hoặc xóa dữ liệu của dòng.');
        requireField(member.dateOfBirth, `${prefix}: thiếu ngày sinh`, 'Dòng thành viên đã nhập một phần nhưng chưa đủ ngày sinh.', 'Nhập ngày sinh của thành viên.');
        requireField(member.gender, `${prefix}: thiếu giới tính`, 'Dòng thành viên đã nhập một phần nhưng chưa chọn giới tính.', 'Chọn giới tính của thành viên.');
        requireField(member.relationshipWithHead, `${prefix}: thiếu quan hệ với chủ hộ`, 'Dòng thành viên đã nhập một phần nhưng chưa chọn quan hệ.', 'Chọn quan hệ với chủ hộ.');
        if (!isCitizenId(member.citizenId)) {
            addItem(errors, `${prefix}: số ĐDCN chưa hợp lệ`, 'Số định danh thành viên phải gồm đúng 12 chữ số.', 'Kiểm tra lại số định danh cá nhân của thành viên.');
        }
    });

    if (!formData.selectedDossierCaseId) {
        addItem(errors, 'Chưa chọn trường hợp hồ sơ đính kèm', 'Hệ thống chưa biết cần kiểm tra bộ giấy tờ nào.', 'Chọn một trường hợp hồ sơ phù hợp.');
    } else {
        const dossierCase = dossierCases.find((item) => item.id === formData.selectedDossierCaseId);
        dossierCase?.documents.forEach((document) => {
            if (!document.required) return;
            const draft = formData.attachmentDrafts[document.id];
            if (!draft?.checked) {
                addItem(errors, `Chưa tick giấy tờ bắt buộc: ${document.name}`, 'Giấy tờ bắt buộc chưa được chọn.', 'Tick chọn giấy tờ trong bảng hồ sơ đính kèm.');
            }
            if (!draft?.fileName) {
                addItem(warnings, `Chưa có file đính kèm: ${document.name}`, 'Giấy tờ bắt buộc chưa có tệp demo.', 'Bấm Chọn file để gán tên tệp đính kèm.');
            }
        });
    }

    if (formData.resultMethod === 'truc-tiep') {
        addItem(warnings, 'Nhận kết quả trực tiếp', 'Người dân cần đến cơ quan thực hiện để nhận kết quả.', 'Chuẩn bị giấy tờ tùy thân khi đến nhận kết quả.');
    }

    if (formData.feeType === 'mien-phi' && !formData.feeExemptionReason.trim()) {
        addItem(errors, 'Thiếu lý do miễn lệ phí', 'Đã chọn miễn phí nhưng chưa nhập lý do.', 'Nhập lý do miễn lệ phí.');
    }

    if (warnings.length > 0) suggestions.push('Rà soát lại các cảnh báo trước khi nộp để giảm khả năng bị yêu cầu bổ sung.');
    if (errors.length === 0 && warnings.length === 0) suggestions.push('Hồ sơ đủ điều kiện tiền kiểm trong bản demo GovBridge.');

    const riskScore = Math.min(100, errors.length * 22 + warnings.length * 8);
    return {
        status: errors.length > 0 ? 'INVALID' : warnings.length > 0 ? 'NEED_REVIEW' : 'VALID',
        riskScore,
        errors,
        warnings,
        suggestions,
    };
};
