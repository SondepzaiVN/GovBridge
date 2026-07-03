import React, { useMemo, useState } from 'react';
import {
    Building2,
    CheckCircle2,
    ChevronRight,
    Clock3,
    Download,
    Eye,
    FileCheck2,
    FileClock,
    Files,
    FileText,
    Inbox,
    LayoutDashboard,
    Mail,
    MapPin,
    Phone,
    UserRound,
    X,
    XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { getAttachmentFile, type AttachmentMetadata } from '../../utils/attachmentStorage';
import { loadDashboardApplications } from '../../utils/applicationDashboardData';
import {
    MISSING_OFFICER_VALUE,
    filterOfficerApplications,
    type OfficerApplication,
    type OfficerApplicationFilters,
    type OfficerApplicationStatus,
} from '../../utils/officerApplicationFilters';

type PreviewFile = {
    fileName: string;
    url: string;
    type: 'pdf' | 'image' | 'docx' | 'unknown';
    attachment: AttachmentMetadata;
};

const statusClassName = (status: OfficerApplicationStatus) => {
    if (status === 'Chờ tiếp nhận') return 'pending';
    if (status === 'Đang xử lí') return 'processing';
    if (status === 'Đã tiếp nhận') return 'accepted';
    if (status === 'Đã phê duyệt') return 'approved';
    if (status === 'Đã từ chối') return 'rejected';
    return 'missing';
};

const formatFileSize = (size: number) => {
    if (!Number.isFinite(size) || size <= 0) return MISSING_OFFICER_VALUE;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const fileTypeLabel = (attachment: AttachmentMetadata) => {
    const extension = attachment.fileName.split('.').pop()?.toUpperCase();
    return extension || attachment.mimeType || MISSING_OFFICER_VALUE;
};

const CitizenDashboardPage: React.FC = () => {
    const { user } = useAuth();
    const [applications] = useState<OfficerApplication[]>(loadDashboardApplications);
    const [statusFilter, setStatusFilter] = useState<OfficerApplicationFilters['status']>('Tất cả');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);
    const [attachmentNotice, setAttachmentNotice] = useState('');

    const filteredApplications = useMemo(() => filterOfficerApplications(
        applications,
        { status: statusFilter },
    ), [applications, statusFilter]);
    const selectedApplication = filteredApplications.find((application) => application.id === selectedId);

    const counts = useMemo(() => ({
        pending: applications.filter((application) => application.status === 'Chờ tiếp nhận').length,
        accepted: applications.filter((application) => application.status === 'Đã tiếp nhận').length,
        processing: applications.filter((application) => application.status === 'Đang xử lí').length,
        approved: applications.filter((application) => application.status === 'Đã phê duyệt').length,
        rejected: applications.filter((application) => application.status === 'Đã từ chối').length,
    }), [applications]);

    const showAttachmentNotice = (message: string) => {
        setAttachmentNotice(message);
        window.setTimeout(() => setAttachmentNotice(''), 3000);
    };

    const getAttachmentBlob = async (attachment: AttachmentMetadata) => {
        if (!attachment.storageKey) {
            showAttachmentNotice('Không tìm thấy dữ liệu tệp do thiếu mã lưu trữ.');
            return null;
        }
        try {
            const blob = await getAttachmentFile(attachment.storageKey);
            if (!blob) showAttachmentNotice('Tệp không còn tồn tại trong hệ thống.');
            return blob;
        } catch {
            showAttachmentNotice('Không thể đọc tệp đính kèm. Vui lòng thử lại.');
            return null;
        }
    };

    const handleDownloadAttachment = async (attachment: AttachmentMetadata) => {
        const blob = await getAttachmentBlob(attachment);
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = attachment.fileName || 'tep-dinh-kem';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const handlePreviewAttachment = async (attachment: AttachmentMetadata) => {
        const blob = await getAttachmentBlob(attachment);
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const isDocx = attachment.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            || attachment.fileName.toLocaleLowerCase('vi').endsWith('.docx');
        const type = isDocx
            ? 'docx'
            : attachment.mimeType.startsWith('image/')
                ? 'image'
                : attachment.mimeType === 'application/pdf'
                    ? 'pdf'
                    : 'unknown';
        setPreviewFile({ fileName: attachment.fileName, url, type, attachment });
    };

    const handleClosePreview = () => {
        if (previewFile) URL.revokeObjectURL(previewFile.url);
        setPreviewFile(null);
    };

    const applyStatusFilter = (status: OfficerApplicationFilters['status']) => {
        setStatusFilter(status);
        if (selectedApplication && status !== 'Tất cả' && selectedApplication.status !== status) {
            setSelectedId(null);
        }
    };

    const location = selectedApplication
        ? [selectedApplication.address, selectedApplication.wardName, selectedApplication.districtName, selectedApplication.provinceName]
            .filter((value, index, values) => value !== MISSING_OFFICER_VALUE && values.indexOf(value) === index)
            .join(', ') || MISSING_OFFICER_VALUE
        : MISSING_OFFICER_VALUE;

    return (
        <div className="officer-portal citizen-dashboard">
            <aside className="officer-sidebar" aria-label="Lọc hồ sơ của tôi">
                <div className="officer-sidebar-title">
                    <span>Khu vực người dân</span>
                    <strong>Hồ sơ của tôi</strong>
                </div>
                <nav>
                    <button type="button" className={statusFilter === 'Tất cả' ? 'active' : ''} onClick={() => applyStatusFilter('Tất cả')}><LayoutDashboard size={17} /> Tất cả hồ sơ <span>{applications.length}</span></button>
                    <button type="button" className={statusFilter === 'Chờ tiếp nhận' ? 'active' : ''} onClick={() => applyStatusFilter('Chờ tiếp nhận')}><Inbox size={17} /> Chờ tiếp nhận <span>{counts.pending}</span></button>
                    <button type="button" className={statusFilter === 'Đã tiếp nhận' ? 'active' : ''} onClick={() => applyStatusFilter('Đã tiếp nhận')}><FileCheck2 size={17} /> Đã tiếp nhận <span>{counts.accepted}</span></button>
                    <button type="button" className={statusFilter === 'Đang xử lí' ? 'active' : ''} onClick={() => applyStatusFilter('Đang xử lí')}><FileClock size={17} /> Đang xử lí <span>{counts.processing}</span></button>
                    <button type="button" className={statusFilter === 'Đã phê duyệt' ? 'active' : ''} onClick={() => applyStatusFilter('Đã phê duyệt')}><CheckCircle2 size={17} /> Đã phê duyệt <span>{counts.approved}</span></button>
                    <button type="button" className={statusFilter === 'Đã từ chối' ? 'active' : ''} onClick={() => applyStatusFilter('Đã từ chối')}><XCircle size={17} /> Đã từ chối <span>{counts.rejected}</span></button>
                </nav>
                <div className="officer-sidebar-user">
                    <UserRound size={18} />
                    <div><strong>{user?.name || MISSING_OFFICER_VALUE}</strong><span>Người dân</span></div>
                </div>
            </aside>

            <main className="officer-main">
                <header className="officer-page-heading">
                    <div>
                        <span>Theo dõi dịch vụ công</span>
                        <h1>Hồ sơ của tôi</h1>
                        <p>Xem trạng thái, thông tin và tệp đính kèm của các hồ sơ đã nộp.</p>
                    </div>
                    <div className="officer-heading-date"><Clock3 size={17} /> Cập nhật: {new Date().toLocaleDateString('vi-VN')}</div>
                </header>

                <section className="officer-summary" aria-label="Tổng quan hồ sơ của tôi">
                    <article><Files size={19} /><div><strong>{applications.length}</strong><span>Tổng hồ sơ</span></div></article>
                    <article><FileClock size={19} /><div><strong>{counts.pending + counts.accepted + counts.processing}</strong><span>Đang giải quyết</span></div></article>
                    <article><CheckCircle2 size={19} /><div><strong>{counts.approved}</strong><span>Đã phê duyệt</span></div></article>
                    <article><XCircle size={19} /><div><strong>{counts.rejected}</strong><span>Đã từ chối</span></div></article>
                </section>

                <section className={`officer-workspace citizen-workspace${selectedApplication ? '' : ' list-only'}`}>
                    <div className="officer-list-pane">
                        <div className="officer-table-wrap">
                            <table className="officer-application-table citizen-application-table">
                                <thead><tr><th>Hồ sơ</th><th>Ngày nộp</th><th>Cơ quan tiếp nhận</th><th>Trạng thái</th><th aria-label="Thao tác" /></tr></thead>
                                <tbody>
                                    {filteredApplications.map((application) => (
                                        <tr key={application.id} className={application.id === selectedId ? 'selected' : ''} onClick={() => setSelectedId(application.id)}>
                                            <td><strong>{application.applicationCode}</strong><span>{application.procedureName}</span><small>{application.procedureTypeLabel}</small></td>
                                            <td>{application.submittedAt}</td>
                                            <td>{application.receivingAgency}</td>
                                            <td><span className={`officer-status ${statusClassName(application.statusLabel)}`}>{application.statusLabel}</span></td>
                                            <td><button type="button" onClick={(event) => { event.stopPropagation(); setSelectedId(application.id); }} aria-label={`Xem hồ sơ ${application.id}`}><ChevronRight size={17} /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {applications.length === 0 && <div className="officer-empty"><Files size={28} /><span>Chưa có hồ sơ nào</span></div>}
                            {applications.length > 0 && filteredApplications.length === 0 && <div className="officer-empty"><Files size={28} /><span>Không có hồ sơ phù hợp</span><button type="button" onClick={() => applyStatusFilter('Tất cả')}>Xóa bộ lọc</button></div>}
                        </div>
                    </div>

                    {selectedApplication && (
                        <aside className="officer-detail-pane" aria-label="Chi tiết hồ sơ của tôi">
                            <div className="officer-detail-heading">
                                <div><span>Chi tiết hồ sơ</span><h2>{selectedApplication.applicationCode}</h2></div>
                                <div className="citizen-detail-heading-actions">
                                    <span className={`officer-status ${statusClassName(selectedApplication.statusLabel)}`}>{selectedApplication.statusLabel}</span>
                                    <button type="button" className="citizen-detail-close" onClick={() => setSelectedId(null)} aria-label="Đóng chi tiết hồ sơ"><X size={17} /></button>
                                </div>
                            </div>

                            <div className="officer-detail-scroll citizen-detail-scroll">
                                <section className="officer-detail-section">
                                    <h3><FileText size={17} /> Thông tin hồ sơ</h3>
                                    <dl className="officer-info-grid">
                                        <div><dt>Thủ tục</dt><dd>{selectedApplication.procedureName}</dd></div>
                                        <div><dt>Loại thủ tục</dt><dd>{selectedApplication.procedureTypeLabel}</dd></div>
                                        <div><dt>Ngày nộp</dt><dd>{selectedApplication.submittedAt}</dd></div>
                                        <div><dt><Building2 size={13} /> Cơ quan tiếp nhận</dt><dd>{selectedApplication.receivingAgency}</dd></div>
                                        <div><dt>Người nộp</dt><dd>{selectedApplication.applicant}</dd></div>
                                        <div><dt>Số ĐDCN/CCCD</dt><dd>{selectedApplication.citizenId}</dd></div>
                                        <div><dt><Phone size={13} /> Điện thoại</dt><dd>{selectedApplication.phone}</dd></div>
                                        <div><dt><Mail size={13} /> Email</dt><dd>{selectedApplication.email}</dd></div>
                                        <div><dt><MapPin size={13} /> Địa chỉ</dt><dd>{location}</dd></div>
                                    </dl>
                                </section>

                                {(selectedApplication.requestContent !== MISSING_OFFICER_VALUE
                                    || selectedApplication.message !== MISSING_OFFICER_VALUE
                                    || selectedApplication.caseNote !== MISSING_OFFICER_VALUE) && (
                                    <section className="officer-detail-section">
                                        <h3><FileText size={17} /> Nội dung yêu cầu</h3>
                                        <dl className="officer-info-grid">
                                            {selectedApplication.requestContent !== MISSING_OFFICER_VALUE && <div><dt>Nội dung</dt><dd>{selectedApplication.requestContent}</dd></div>}
                                            {selectedApplication.message !== MISSING_OFFICER_VALUE && <div><dt>Tin nhắn</dt><dd>{selectedApplication.message}</dd></div>}
                                            {selectedApplication.caseNote !== MISSING_OFFICER_VALUE && <div><dt>Ghi chú hồ sơ</dt><dd>{selectedApplication.caseNote}</dd></div>}
                                        </dl>
                                    </section>
                                )}

                                <section className="officer-detail-section">
                                    <h3><Files size={17} /> Tệp đính kèm đã nộp</h3>
                                    {selectedApplication.attachments.length > 0 ? (
                                        <ul className="officer-document-list officer-attachment-list">
                                            {selectedApplication.attachments.map((attachment) => (
                                                <li key={attachment.id} className="officer-attachment-item">
                                                    <div className="officer-attachment-info">
                                                        <FileText size={16} />
                                                        <div className="officer-attachment-text">
                                                            <span className="officer-attachment-name clickable" onClick={() => handlePreviewAttachment(attachment)}>{attachment.fileName || MISSING_OFFICER_VALUE}</span>
                                                            <small>{fileTypeLabel(attachment)} · {formatFileSize(attachment.size)}</small>
                                                        </div>
                                                    </div>
                                                    <div className="officer-attachment-actions">
                                                        <button type="button" className="officer-attachment-btn" onClick={() => handlePreviewAttachment(attachment)}><Eye size={14} /> Xem</button>
                                                        <button type="button" className="officer-attachment-btn" onClick={() => handleDownloadAttachment(attachment)}><Download size={14} /> Tải xuống</button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : <p className="citizen-empty-attachments">Không có tệp đính kèm.</p>}
                                </section>
                            </div>
                        </aside>
                    )}
                </section>
            </main>

            {attachmentNotice && <div className="officer-toast" role="status"><FileText size={18} /> {attachmentNotice}</div>}

            {previewFile && (
                <div className="officer-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) handleClosePreview(); }}>
                    <section className="officer-preview-modal" role="dialog" aria-modal="true" aria-labelledby="citizen-preview-title">
                        <div className="officer-preview-header">
                            <h2 id="citizen-preview-title">{previewFile.fileName}</h2>
                            <button type="button" className="citizen-detail-close" onClick={handleClosePreview} aria-label="Đóng xem trước"><X size={18} /></button>
                        </div>
                        <div className="officer-preview-content">
                            {previewFile.type === 'pdf' && <iframe src={previewFile.url} title={previewFile.fileName} />}
                            {previewFile.type === 'image' && <img src={previewFile.url} alt={previewFile.fileName} />}
                            {previewFile.type === 'docx' && <div className="officer-preview-fallback"><p>Không thể xem trước DOCX trực tiếp. Vui lòng tải xuống để xem.</p></div>}
                            {previewFile.type === 'unknown' && <div className="officer-preview-fallback"><p>Không hỗ trợ xem trước định dạng tệp này. Vui lòng tải xuống để xem.</p></div>}
                        </div>
                        <div className="officer-modal-actions">
                            <button type="button" onClick={handleClosePreview}>Đóng</button>
                            <button type="button" className="accept" onClick={() => handleDownloadAttachment(previewFile.attachment)}><Download size={16} /> Tải xuống</button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default CitizenDashboardPage;
