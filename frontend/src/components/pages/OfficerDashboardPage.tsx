import React, { useMemo, useState, useEffect } from 'react';
import {
    AlertTriangle,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    CircleEllipsis,
    FileCheck2,
    FileClock,
    Files,
    FileText,
    Inbox,
    LayoutDashboard,
    Mail,
    MessageSquareText,
    Phone,
    RotateCcw,
    Send,
    UserRound,
    X,
    XCircle,
    Settings,
    Download,
    Eye,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { getAttachmentFile, type AttachmentMetadata } from '../../utils/attachmentStorage';
import {
    DASHBOARD_STORAGE_KEY,
    fetchDashboardApplications,
} from '../../utils/applicationDashboardData';
import {
    filterOfficerApplications,
    type OfficerApplication as Application,
    type OfficerApplicationFilters,
    type OfficerApplicationStatus as ApplicationStatus,
} from '../../utils/officerApplicationFilters';

type ConfirmAction = 'accept' | 'reject' | 'process' | 'approve' | null;

const statusClassName = (status: ApplicationStatus) => {
    if (status === 'Chờ tiếp nhận') return 'pending';
    if (status === 'Đang xử lí') return 'processing';
    if (status === 'Đã tiếp nhận') return 'accepted';
    if (status === 'Đã phê duyệt') return 'approved';
    if (status === 'Đã từ chối') return 'rejected';
    return 'missing';
};

const OfficerDashboardPage: React.FC = () => {
    const { user } = useAuth();
    const [applications, setApplications] = useState<Application[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<OfficerApplicationFilters['status']>('Tất cả');
    const [returnReason, setReturnReason] = useState('');
    const [message, setMessage] = useState('');
    const [reasonError, setReasonError] = useState('');
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
    const [toast, setToast] = useState('');

    const [previewFile, setPreviewFile] = useState<{
        fileName: string;
        mimeType: string;
        url: string;
        type: 'pdf' | 'image' | 'docx' | 'unknown';
        attachment: AttachmentMetadata;
    } | null>(null);

    const filteredApplications = useMemo(() => filterOfficerApplications(
        applications,
        { status: statusFilter },
    ), [applications, statusFilter]);
    const selectedApplication = filteredApplications.find((application) => application.id === selectedId)
        ?? filteredApplications[0]
        ?? applications[0];
    const officerNote = selectedApplication?.officerNote ?? '';
    const officerNoteFlag = selectedApplication?.officerNoteFlag ?? '';
    const [isNoteExpanded, setIsNoteExpanded] = useState(true);

    const loadApplications = async () => {
        const data = await fetchDashboardApplications();
        setApplications(data);
    };

    useEffect(() => {
        loadApplications();
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === DASHBOARD_STORAGE_KEY) {
                loadApplications();
            }
        };
        const handleDashboardUpdate = () => {
            loadApplications();
        };
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('dashboard-updated', handleDashboardUpdate);
        
        // Also poll every 30 seconds for new apps
        const interval = setInterval(loadApplications, 30000);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('dashboard-updated', handleDashboardUpdate);
            clearInterval(interval);
        };
    }, []);



    const handleDownloadAttachment = async (attachment: AttachmentMetadata) => {
        try {
            if (!attachment.storageKey) {
                alert('Không tìm thấy dữ liệu tệp (thiếu storage key).');
                return;
            }
            const blob = await getAttachmentFile(attachment.storageKey);
            if (!blob) {
                alert('Tệp tin không tồn tại trong hệ thống (có thể do đã bị xoá).');
                return;
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = attachment.fileName || 'tep-dinh-kem';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            console.error(err);
            alert('Có lỗi xảy ra khi tải xuống tệp tin.');
        }
    };

    const handlePreviewAttachment = async (attachment: AttachmentMetadata) => {
        try {
            if (!attachment.storageKey) {
                alert('Không tìm thấy dữ liệu tệp (thiếu storage key).');
                return;
            }

            const blob = await getAttachmentFile(attachment.storageKey);
            if (!blob) {
                alert('Tệp tin không tồn tại trong hệ thống (có thể do đã bị xoá).');
                return;
            }
            const url = URL.createObjectURL(blob);
            
            const isDocx = attachment.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || attachment.fileName.toLowerCase().endsWith('.docx');
            const type = isDocx ? 'docx' : (attachment.mimeType.startsWith('image/') ? 'image' : (attachment.mimeType === 'application/pdf' ? 'pdf' : 'unknown'));

            setPreviewFile({
                fileName: attachment.fileName,
                mimeType: attachment.mimeType,
                url,
                type,
                attachment
            });
        } catch (err) {
            console.error(err);
            alert('Có lỗi xảy ra khi xem tệp tin.');
        }
    };

    const handleClosePreview = () => {
        if (previewFile?.url) {
            URL.revokeObjectURL(previewFile.url);
        }
        setPreviewFile(null);
    };

    const formatFileName = (name: string) => {
        if (!name) return '';
        if (name.length > 30) {
            const parts = name.split('.');
            const ext = parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
            return `Tệp tải lên${ext}`;
        }
        return name;
    };

    const counts = useMemo(() => ({
        pending: applications.filter((application) => application.status === 'Chờ tiếp nhận').length,
        processing: applications.filter((application) => application.status === 'Đang xử lí').length,
        accepted: applications.filter((application) => application.status === 'Đã tiếp nhận').length,
        rejected: applications.filter((application) => application.status === 'Đã từ chối').length,
        approved: applications.filter((application) => application.status === 'Đã phê duyệt').length,
    }), [applications]);

    const selectApplication = (id: string) => {
        setSelectedId(id);
        setReturnReason('');
        setMessage('');
        setReasonError('');
    };

    const applyStatusFilter = (status: OfficerApplicationFilters['status']) => {
        setStatusFilter(status);
        const firstMatch = filterOfficerApplications(applications, { status })[0];
        if (firstMatch) setSelectedId(firstMatch.id);
        setReturnReason('');
        setMessage('');
        setReasonError('');
    };

    const requestReject = () => {
        const isValid = returnReason && returnReason.trim().length > 0 && returnReason.trim() !== 'Điền thiếu';
        if (!isValid) {
            setReasonError('Vui lòng nhập lý do trả về trước khi từ chối hồ sơ.');
            setToast('Vui lòng nhập lý do trả về trước khi từ chối hồ sơ.');
            window.setTimeout(() => setToast(''), 3000);
            return;
        }
        setReasonError('');
        setConfirmAction('reject');
    };

    const completeAction = async () => {
        if (!confirmAction) return;
        if (!selectedApplication) return;

        if (confirmAction === 'reject') {
            const isValid = returnReason && returnReason.trim().length > 0 && returnReason.trim() !== 'Điền thiếu';
            if (!isValid) {
                setReasonError('Vui lòng nhập lý do trả về trước khi từ chối hồ sơ.');
                setToast('Vui lòng nhập lý do trả về trước khi từ chối hồ sơ.');
                window.setTimeout(() => setToast(''), 3000);
                setConfirmAction(null);
                return;
            }
        }
        const nextStatus: ApplicationStatus = 
            confirmAction === 'accept' ? 'Đã tiếp nhận' :
            confirmAction === 'process' ? 'Đang xử lí' :
            confirmAction === 'approve' ? 'Đã phê duyệt' : 'Đã từ chối';
            
        const updates: Partial<Application> = { 
            status: nextStatus,
            statusLabel: nextStatus
        };
        if (confirmAction === 'reject') {
            updates.returnReason = returnReason || 'Điền thiếu';
            updates.responseMessage = message || 'Điền thiếu';
        }

        try {
            const response = await fetch(`/api/v1/dashboard/applications/${selectedApplication.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!response.ok) throw new Error('Failed to update status on backend');

            setApplications((current) => {
                return current.map((application) => {
                    if (application.id === selectedApplication.id) {
                        return { ...application, ...updates };
                    }
                    return application;
                });
            });

            if (confirmAction === 'accept') setToast(`Đã tiếp nhận hồ sơ ${selectedApplication.id}.`);
            else if (confirmAction === 'process') setToast(`Đã bắt đầu xử lý hồ sơ ${selectedApplication.id}.`);
            else if (confirmAction === 'approve') setToast(`Đã phê duyệt hồ sơ ${selectedApplication.id}.`);
            else setToast(`Đã từ chối hồ sơ ${selectedApplication.id}.`);
        } catch (e) {
            console.error(e);
            setToast(`Lỗi: Không thể cập nhật trạng thái hồ sơ ${selectedApplication.id}.`);
        }

        setConfirmAction(null);
        setReturnReason('');
        setMessage('');
        window.setTimeout(() => setToast(''), 2600);
    };

    return (
        <div className="officer-portal">
            <aside className="officer-sidebar" aria-label="Nghiệp vụ cán bộ">
                <div className="officer-sidebar-title">
                    <span>Hệ thống một cửa</span>
                    <strong>Xử lý hồ sơ</strong>
                </div>
                <nav>
                    <button type="button" className={statusFilter === 'Tất cả' ? 'active' : ''} onClick={() => applyStatusFilter('Tất cả')}><LayoutDashboard size={17} /> Tất cả hồ sơ <span>{applications.length}</span></button>
                    <button type="button" className={statusFilter === 'Chờ tiếp nhận' ? 'active' : ''} onClick={() => applyStatusFilter('Chờ tiếp nhận')}><Inbox size={17} /> Hồ sơ chờ tiếp nhận <span>{counts.pending}</span></button>
                    <button type="button" className={statusFilter === 'Đang xử lí' ? 'active' : ''} onClick={() => applyStatusFilter('Đang xử lí')}><FileClock size={17} /> Hồ sơ đang xử lí <span>{counts.processing}</span></button>
                    <button type="button" className={statusFilter === 'Đã tiếp nhận' ? 'active' : ''} onClick={() => applyStatusFilter('Đã tiếp nhận')}><FileCheck2 size={17} /> Hồ sơ đã tiếp nhận <span>{counts.accepted}</span></button>
                    <button type="button" className={statusFilter === 'Đã phê duyệt' ? 'active' : ''} onClick={() => applyStatusFilter('Đã phê duyệt')}><CheckCircle2 size={17} /> Hồ sơ đã phê duyệt <span>{counts.approved}</span></button>
                    <button type="button" className={statusFilter === 'Đã từ chối' ? 'active' : ''} onClick={() => applyStatusFilter('Đã từ chối')}><XCircle size={17} /> Hồ sơ đã từ chối <span>{counts.rejected}</span></button>
                </nav>
                <div className="officer-sidebar-user">
                    <UserRound size={18} />
                    <div><strong>{user?.name}</strong><span>{user?.agency}</span></div>
                </div>
            </aside>

            <main className="officer-main">
                <header className="officer-page-heading">
                    <div>
                        <span>Tiếp nhận và xử lý</span>
                        <h1>Hồ sơ trực tuyến</h1>
                        <p>Kiểm tra thông tin, thành phần hồ sơ và cập nhật kết quả tiếp nhận.</p>
                    </div>
                </header>

                <section className="officer-summary" aria-label="Thống kê hồ sơ">
                    <article><Inbox size={19} /><div><strong>{counts.pending}</strong><span>Chờ tiếp nhận</span></div></article>
                    <article><FileClock size={19} /><div><strong>{counts.processing}</strong><span>Đang xử lí</span></div></article>
                    <article><CheckCircle2 size={19} /><div><strong>{counts.accepted}</strong><span>Đã tiếp nhận</span></div></article>
                </section>

                <section className="officer-workspace">
                    <div className="officer-list-pane">
                        <div className="officer-table-wrap">
                            <table className="officer-application-table">
                                <thead><tr><th>Hồ sơ</th><th>Người nộp</th><th>Hạn xử lý</th><th>Trạng thái</th><th aria-label="Thao tác" /></tr></thead>
                                <tbody>
                                    {filteredApplications.map((application) => (
                                        <tr key={application.id} className={application.id === selectedApplication.id ? 'selected' : ''} onClick={() => selectApplication(application.id)}>
                                            <td><strong>{application.id}</strong><span>{application.procedure}</span><small>Nộp: {application.submittedAt}</small></td>
                                            <td><strong>{application.applicant}</strong><span>{application.citizenId}</span></td>
                                            <td>{application.dueDate}</td>
                                            <td><span className={`officer-status ${statusClassName(application.status)}`}>{application.status}</span></td>
                                            <td><button type="button" onClick={(event) => { event.stopPropagation(); selectApplication(application.id); }} aria-label={`Xem hồ sơ ${application.id}`}><ChevronRight size={17} /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredApplications.length === 0 && <div className="officer-empty"><Files size={28} /><span>Không có hồ sơ phù hợp</span><button type="button" onClick={() => applyStatusFilter('Tất cả')}>Xóa bộ lọc</button></div>}
                        </div>
                    </div>

                    {filteredApplications.length > 0 && (
                        <aside className="officer-detail-pane" aria-label="Chi tiết hồ sơ">
                            <div className="officer-detail-heading">
                            <div><span>Chi tiết hồ sơ</span><h2>{selectedApplication.id}</h2></div>
                            <span className={`officer-status ${statusClassName(selectedApplication.status)}`}>{selectedApplication.status}</span>
                        </div>

                        <div className="officer-detail-scroll">
                            <section className="officer-detail-section" style={{ backgroundColor: '#f0f9ff', borderColor: '#bae6fd', borderWidth: '1px', borderStyle: 'solid', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ backgroundColor: officerNoteFlag === 'red' ? '#ef4444' : officerNoteFlag === 'green' ? '#22c55e' : '#0ea5e9', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>AI đánh giá</span>
                                        <h3 style={{ margin: 0, color: '#0369a1', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}><FileText size={17} /> Lưu ý hồ sơ</h3>
                                    </div>
                                    <button
                                        onClick={() => setIsNoteExpanded(!isNoteExpanded)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0284c7', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        title={isNoteExpanded ? 'Thu gọn' : 'Mở rộng'}
                                    >
                                        {isNoteExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </button>
                                </div>
                                {isNoteExpanded && (
                                    <div style={{ fontSize: '14px', color: '#334155', lineHeight: '1.5', whiteSpace: 'pre-wrap', backgroundColor: 'white', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                                        {officerNote || <span style={{ fontStyle: 'italic', color: '#64748b' }}>Chưa có đánh giá AI cho hồ sơ này.</span>}
                                    </div>
                                )}
                            </section>

                            <section className="officer-detail-section">
                                <h3><FileText size={17} /> Thông tin hồ sơ</h3>
                                <dl className="officer-info-grid">
                                    <div><dt>Thủ tục</dt><dd>{selectedApplication.procedure}</dd></div>
                                    <div><dt>Người nộp</dt><dd>{selectedApplication.applicant}</dd></div>
                                    <div><dt>Số ĐDCN/CCCD</dt><dd>{selectedApplication.citizenId}</dd></div>
                                    <div><dt>Kênh nộp</dt><dd>{selectedApplication.channel}</dd></div>
                                    <div><dt><Phone size={13} /> Điện thoại</dt><dd>{selectedApplication.phone}</dd></div>
                                    <div><dt><Mail size={13} /> Email</dt><dd>{selectedApplication.email}</dd></div>
                                </dl>
                            </section>

                            {selectedApplication.details && Object.keys(selectedApplication.details).length > 0 && (
                                <section className="officer-detail-section">
                                    <h3><FileText size={17} /> Chi tiết bổ sung</h3>
                                    <dl className="officer-info-grid">
                                        {Object.entries(selectedApplication.details).map(([key, value]) => (
                                            <div key={key}><dt>{key}</dt><dd>{value}</dd></div>
                                        ))}
                                    </dl>
                                </section>
                            )}

                            {(selectedApplication.message || selectedApplication.caseNote) && (
                                <section className="officer-detail-section">
                                    <h3><MessageSquareText size={17} /> Ghi chú từ người nộp</h3>
                                    <dl className="officer-info-grid">
                                        {selectedApplication.message && <div><dt>Lời nhắn</dt><dd>{selectedApplication.message}</dd></div>}
                                        {selectedApplication.caseNote && <div><dt>Lưu ý</dt><dd>{selectedApplication.caseNote}</dd></div>}
                                    </dl>
                                </section>
                            )}

                            <section className="officer-detail-section">
                                <h3><Files size={17} /> Thành phần hồ sơ đính kèm</h3>
                                {(selectedApplication.documents || []).length > 0 ? (
                                    <ul className="officer-document-list officer-attachment-list">
                                        {(selectedApplication.documents || []).map((document, index) => {
                                            const attachment = Array.isArray(selectedApplication.attachments) 
                                                ? selectedApplication.attachments.find(a => a.fileName === document.name)
                                                : undefined;
                                            
                                            return (
                                                <li key={`${document.name}-${index}`} className="officer-attachment-item">
                                                    <div className="officer-attachment-info">
                                                        <FileText size={16} />
                                                        <div className="officer-attachment-text">
                                                            {attachment ? (
                                                                <span className="officer-attachment-name clickable" onClick={() => handlePreviewAttachment(attachment)}>
                                                                    {formatFileName(document.name)}
                                                                </span>
                                                            ) : (
                                                                <span className="officer-attachment-name">
                                                                    {formatFileName(document.name)}
                                                                </span>
                                                            )}
                                                            <small style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                                <span className={document.state === 'Đã có' ? 'complete' : 'review'}>{document.state}</span>
                                                                {attachment?.size ? <span>• {(attachment.size / 1024).toFixed(1)} KB</span> : null}
                                                            </small>
                                                        </div>
                                                    </div>
                                                    {attachment && (
                                                        <div className="officer-attachment-actions">
                                                            <button type="button" className="officer-attachment-btn" onClick={() => handlePreviewAttachment(attachment)}>
                                                                <Eye size={14} /> Xem
                                                            </button>
                                                            <button type="button" className="officer-attachment-btn" onClick={() => handleDownloadAttachment(attachment)}>
                                                                <Download size={14} /> Tải về
                                                            </button>
                                                        </div>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <p style={{ color: 'var(--gray-500)', fontSize: '13px' }}>Không có thành phần hồ sơ nào.</p>
                                )}
                            </section>


                            <section className="officer-detail-section">
                                <h3><CircleEllipsis size={17} /> Trạng thái xử lý</h3>
                                <ol className="officer-timeline">
                                    <li className="done"><span><Check size={12} /></span><div><strong>Đã nộp trực tuyến</strong><small>{selectedApplication.submittedAt}</small></div></li>
                                    <li className={selectedApplication.status !== 'Chờ tiếp nhận' ? 'done' : 'current'}><span>{selectedApplication.status !== 'Chờ tiếp nhận' ? <Check size={12} /> : '2'}</span><div><strong>Tiếp nhận hồ sơ</strong><small>{selectedApplication.status}</small></div></li>
                                    <li><span>3</span><div><strong>Xử lý chuyên môn</strong><small>Chưa thực hiện</small></div></li>
                                </ol>
                            </section>

                            <section className="officer-detail-section officer-response-section">
                                <h3><RotateCcw size={17} /> Phản hồi người nộp</h3>
                                <label htmlFor="return-reason">Lý do trả về <span>*</span></label>
                                <textarea id="return-reason" value={returnReason} onChange={(event) => { setReturnReason(event.target.value); setReasonError(''); }} placeholder="Nhập lý do trong trường hợp từ chối nhận hồ sơ..." maxLength={500} />
                                <div className="officer-field-meta"><span className="officer-field-error">{reasonError}</span><span>{returnReason.length}/500</span></div>

                                <label htmlFor="officer-message"><MessageSquareText size={14} /> Tin nhắn kèm theo</label>
                                <textarea id="officer-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Nhập nội dung thông báo gửi tới người nộp..." maxLength={500} />
                                <div className="officer-field-meta"><span>Tin nhắn sẽ được gửi qua tài khoản DVC.</span><span>{message.length}/500</span></div>
                            </section>
                        </div>

                        <div className="officer-detail-actions">
                            {selectedApplication.status === 'Chờ tiếp nhận' && (
                                <>
                                    <button type="button" className="officer-reject-button" onClick={requestReject}><XCircle size={17} /> Từ chối nhận hồ sơ</button>
                                    <button type="button" className="officer-accept-button" onClick={() => setConfirmAction('accept')}><FileCheck2 size={17} /> Tiếp nhận hồ sơ</button>
                                </>
                            )}
                            {selectedApplication.status === 'Đã tiếp nhận' && (
                                <>
                                    <button type="button" className="officer-reject-button" onClick={requestReject}><XCircle size={17} /> Từ chối nhận hồ sơ</button>
                                    <button type="button" className="officer-accept-button" onClick={() => setConfirmAction('process')}><Settings size={17} /> Bắt đầu xử lý</button>
                                </>
                            )}
                            {selectedApplication.status === 'Đang xử lí' && (
                                <>
                                    <button type="button" className="officer-reject-button" onClick={requestReject}><XCircle size={17} /> Từ chối hồ sơ</button>
                                    <button type="button" className="officer-accept-button" onClick={() => setConfirmAction('approve')}><CheckCircle2 size={17} /> Phê duyệt hồ sơ</button>
                                </>
                            )}
                        </div>
                    </aside>
                    )}
                </section>
            </main>

            {confirmAction && (
                <div className="officer-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmAction(null); }}>
                    <section className="officer-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="officer-confirm-title">
                        <button type="button" className="officer-modal-close" onClick={() => setConfirmAction(null)} aria-label="Đóng"><X size={18} /></button>
                        <div className={`officer-confirm-icon ${confirmAction}`}>
                            {confirmAction === 'accept' ? <FileCheck2 size={26} /> : 
                             confirmAction === 'process' ? <Settings size={26} /> : 
                             confirmAction === 'approve' ? <CheckCircle2 size={26} /> : <AlertTriangle size={26} />}
                        </div>
                        <h2 id="officer-confirm-title">
                            {confirmAction === 'accept' ? 'Tiếp nhận hồ sơ?' : 
                             confirmAction === 'process' ? 'Bắt đầu xử lý?' : 
                             confirmAction === 'approve' ? 'Phê duyệt hồ sơ?' : 'Từ chối nhận hồ sơ?'}
                        </h2>
                        <p>
                            {confirmAction === 'accept' ? `Hồ sơ ${selectedApplication.id} sẽ được ghi nhận đã tiếp nhận và chuyển sang bước xử lý chuyên môn.` : 
                             confirmAction === 'process' ? `Hồ sơ ${selectedApplication.id} sẽ được chuyển sang trạng thái đang xử lí.` :
                             confirmAction === 'approve' ? `Hồ sơ ${selectedApplication.id} sẽ được ghi nhận là Đã phê duyệt và thông báo đến người nộp.` :
                             `Hồ sơ ${selectedApplication.id} sẽ bị từ chối và trả lại cho ${selectedApplication.applicant}.`}
                        </p>
                        {confirmAction === 'reject' && <div className="officer-confirm-reason"><strong>Lý do trả về</strong><span>{returnReason}</span>{message && <><strong>Tin nhắn kèm theo</strong><span>{message}</span></>}</div>}
                        <div className="officer-modal-actions">
                            <button type="button" onClick={() => setConfirmAction(null)}>Hủy</button>
                            <button type="button" className={confirmAction === 'reject' ? 'reject' : 'accept'} onClick={completeAction}>
                                {confirmAction === 'accept' ? <><Send size={16} /> Xác nhận tiếp nhận</> : 
                                 confirmAction === 'process' ? <><Settings size={16} /> Xác nhận xử lý</> : 
                                 confirmAction === 'approve' ? <><CheckCircle2 size={16} /> Xác nhận phê duyệt</> : 
                                 <><XCircle size={16} /> Xác nhận từ chối</>}
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {toast && <div className="officer-toast" role="status"><CheckCircle2 size={18} /> {toast}</div>}

            {previewFile && (
                <div className="officer-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) handleClosePreview(); }}>
                    <section className="officer-preview-modal" role="dialog" aria-modal="true" aria-labelledby="officer-preview-title">
                        <div className="officer-preview-header">
                            <h2 id="officer-preview-title">{previewFile.fileName}</h2>
                            <button type="button" className="officer-modal-close" onClick={handleClosePreview} aria-label="Đóng" style={{ position: 'relative', top: 0, right: 0 }}><X size={18} /></button>
                        </div>
                        
                        <div className="officer-preview-content">
                            {previewFile.type === 'pdf' && (
                                <iframe src={previewFile.url} title={previewFile.fileName} />
                            )}
                            {previewFile.type === 'image' && (
                                <img src={previewFile.url} alt={previewFile.fileName} />
                            )}
                            {previewFile.type === 'docx' && (
                                <div className="officer-preview-fallback">
                                    <p>Không thể xem trước DOCX trực tiếp. Vui lòng tải xuống để xem.</p>
                                </div>
                            )}
                            {previewFile.type === 'unknown' && (
                                <div className="officer-preview-fallback">
                                    <p>Không hỗ trợ xem trước định dạng tệp này. Vui lòng tải xuống để xem.</p>
                                </div>
                            )}
                        </div>

                        <div className="officer-modal-actions">
                            <button type="button" onClick={handleClosePreview}>Đóng</button>
                            <button type="button" className="accept" onClick={() => handleDownloadAttachment(previewFile.attachment)}>
                                <Download size={16} /> Tải xuống
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default OfficerDashboardPage;
