import React, { useMemo, useState } from 'react';
import {
    AlertTriangle,
    Check,
    CheckCircle2,
    ChevronRight,
    CircleEllipsis,
    Clock3,
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
    Search,
    Send,
    UserRound,
    X,
    XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';

type ApplicationStatus = 'Chờ tiếp nhận' | 'Đang xử lý' | 'Đã tiếp nhận' | 'Đã từ chối';

type Application = {
    id: string;
    procedure: string;
    applicant: string;
    citizenId: string;
    phone: string;
    email: string;
    submittedAt: string;
    dueDate: string;
    channel: string;
    status: ApplicationStatus;
    documents: Array<{ name: string; state: 'Đã có' | 'Cần kiểm tra' }>;
};

type ConfirmAction = 'accept' | 'reject' | null;

const INITIAL_APPLICATIONS: Application[] = [
    {
        id: 'GOV-2026-000184',
        procedure: 'Xác nhận thông tin về cư trú',
        applicant: 'Nguyễn Văn An',
        citizenId: '042206001284',
        phone: '0912 345 678',
        email: 'nguyenvanan@example.com',
        submittedAt: '02/07/2026 09:18',
        dueDate: '05/07/2026',
        channel: 'Cổng dịch vụ công',
        status: 'Chờ tiếp nhận',
        documents: [
            { name: 'Tờ khai thay đổi thông tin cư trú', state: 'Đã có' },
            { name: 'Bản chụp Căn cước công dân', state: 'Đã có' },
            { name: 'Giấy tờ chứng minh chỗ ở hợp pháp', state: 'Cần kiểm tra' },
        ],
    },
    {
        id: 'GOV-2026-000179',
        procedure: 'Đăng ký thường trú',
        applicant: 'Trần Thị Minh Hà',
        citizenId: '042301009152',
        phone: '0986 220 114',
        email: 'minhha@example.com',
        submittedAt: '02/07/2026 08:42',
        dueDate: '07/07/2026',
        channel: 'VNeID',
        status: 'Đang xử lý',
        documents: [
            { name: 'Tờ khai CT01', state: 'Đã có' },
            { name: 'Ý kiến chủ hộ', state: 'Đã có' },
        ],
    },
    {
        id: 'GOV-2026-000163',
        procedure: 'Đăng ký tạm trú',
        applicant: 'Lê Hoàng Nam',
        citizenId: '042199006874',
        phone: '0905 118 226',
        email: 'hoangnam@example.com',
        submittedAt: '01/07/2026 15:06',
        dueDate: '04/07/2026',
        channel: 'Cổng dịch vụ công',
        status: 'Chờ tiếp nhận',
        documents: [
            { name: 'Tờ khai CT01', state: 'Đã có' },
            { name: 'Hợp đồng thuê nhà', state: 'Cần kiểm tra' },
        ],
    },
    {
        id: 'GOV-2026-000151',
        procedure: 'Liên thông khai sinh, thường trú, BHYT',
        applicant: 'Phạm Thu Trang',
        citizenId: '042203003612',
        phone: '0934 441 906',
        email: 'thutrang@example.com',
        submittedAt: '01/07/2026 10:25',
        dueDate: '08/07/2026',
        channel: 'Cổng dịch vụ công',
        status: 'Đã tiếp nhận',
        documents: [
            { name: 'Tờ khai đăng ký khai sinh', state: 'Đã có' },
            { name: 'Tờ khai đăng ký cư trú', state: 'Đã có' },
            { name: 'Tờ khai tham gia BHYT', state: 'Đã có' },
        ],
    },
];

const statusClassName = (status: ApplicationStatus) => {
    if (status === 'Chờ tiếp nhận') return 'pending';
    if (status === 'Đang xử lý') return 'processing';
    if (status === 'Đã tiếp nhận') return 'accepted';
    return 'rejected';
};

const OfficerDashboardPage: React.FC = () => {
    const { user } = useAuth();
    const [applications, setApplications] = useState(INITIAL_APPLICATIONS);
    const [selectedId, setSelectedId] = useState(INITIAL_APPLICATIONS[0].id);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'Tất cả' | ApplicationStatus>('Tất cả');
    const [returnReason, setReturnReason] = useState('');
    const [message, setMessage] = useState('');
    const [reasonError, setReasonError] = useState('');
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
    const [toast, setToast] = useState('');

    const selectedApplication = applications.find((application) => application.id === selectedId) ?? applications[0];

    const filteredApplications = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLocaleLowerCase('vi');
        return applications.filter((application) => {
            const matchesStatus = statusFilter === 'Tất cả' || application.status === statusFilter;
            const matchesQuery = !normalizedQuery || [
                application.id,
                application.procedure,
                application.applicant,
                application.citizenId,
            ].some((value) => value.toLocaleLowerCase('vi').includes(normalizedQuery));
            return matchesStatus && matchesQuery;
        });
    }, [applications, searchQuery, statusFilter]);

    const counts = useMemo(() => ({
        pending: applications.filter((application) => application.status === 'Chờ tiếp nhận').length,
        processing: applications.filter((application) => application.status === 'Đang xử lý').length,
        accepted: applications.filter((application) => application.status === 'Đã tiếp nhận').length,
        rejected: applications.filter((application) => application.status === 'Đã từ chối').length,
    }), [applications]);

    const selectApplication = (id: string) => {
        setSelectedId(id);
        setReturnReason('');
        setMessage('');
        setReasonError('');
    };

    const requestReject = () => {
        if (!returnReason.trim()) {
            setReasonError('Vui lòng nhập lý do trả về trước khi từ chối hồ sơ.');
            return;
        }
        setReasonError('');
        setConfirmAction('reject');
    };

    const completeAction = () => {
        if (!confirmAction) return;
        const nextStatus: ApplicationStatus = confirmAction === 'accept' ? 'Đã tiếp nhận' : 'Đã từ chối';
        setApplications((current) => current.map((application) => (
            application.id === selectedApplication.id ? { ...application, status: nextStatus } : application
        )));
        setToast(confirmAction === 'accept'
            ? `Đã xác nhận nộp hồ sơ ${selectedApplication.id}.`
            : `Đã từ chối nhận hồ sơ ${selectedApplication.id}.`);
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
                    <button type="button"><LayoutDashboard size={17} /> Tổng quan</button>
                    <button type="button" className="active"><Inbox size={17} /> Hồ sơ chờ tiếp nhận <span>{counts.pending}</span></button>
                    <button type="button"><FileClock size={17} /> Hồ sơ đang xử lý <span>{counts.processing}</span></button>
                    <button type="button"><FileCheck2 size={17} /> Hồ sơ đã tiếp nhận <span>{counts.accepted}</span></button>
                    <button type="button"><XCircle size={17} /> Hồ sơ đã từ chối <span>{counts.rejected}</span></button>
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
                    <div className="officer-heading-date"><Clock3 size={17} /> Ngày làm việc: 02/07/2026</div>
                </header>

                <section className="officer-summary" aria-label="Thống kê hồ sơ">
                    <article><Inbox size={19} /><div><strong>{counts.pending}</strong><span>Chờ tiếp nhận</span></div></article>
                    <article><FileClock size={19} /><div><strong>{counts.processing}</strong><span>Đang xử lý</span></div></article>
                    <article><CheckCircle2 size={19} /><div><strong>{counts.accepted}</strong><span>Đã tiếp nhận</span></div></article>
                    <article><AlertTriangle size={19} /><div><strong>1</strong><span>Sắp đến hạn</span></div></article>
                </section>

                <section className="officer-workspace">
                    <div className="officer-list-pane">
                        <div className="officer-list-toolbar">
                            <div className="officer-search-box">
                                <Search size={17} />
                                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Tìm mã hồ sơ, người nộp, thủ tục..." aria-label="Tìm kiếm hồ sơ" />
                            </div>
                            <label>
                                <span className="sr-only">Lọc trạng thái</span>
                                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'Tất cả' | ApplicationStatus)}>
                                    <option>Tất cả</option>
                                    <option>Chờ tiếp nhận</option>
                                    <option>Đang xử lý</option>
                                    <option>Đã tiếp nhận</option>
                                    <option>Đã từ chối</option>
                                </select>
                            </label>
                        </div>

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
                            {filteredApplications.length === 0 && <div className="officer-empty"><Files size={28} /><span>Không tìm thấy hồ sơ phù hợp.</span></div>}
                        </div>
                    </div>

                    <aside className="officer-detail-pane" aria-label="Chi tiết hồ sơ">
                        <div className="officer-detail-heading">
                            <div><span>Chi tiết hồ sơ</span><h2>{selectedApplication.id}</h2></div>
                            <span className={`officer-status ${statusClassName(selectedApplication.status)}`}>{selectedApplication.status}</span>
                        </div>

                        <div className="officer-detail-scroll">
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

                            <section className="officer-detail-section">
                                <h3><Files size={17} /> Thành phần hồ sơ</h3>
                                <ul className="officer-document-list">
                                    {selectedApplication.documents.map((document) => (
                                        <li key={document.name}><FileText size={16} /><span>{document.name}</span><small className={document.state === 'Đã có' ? 'complete' : 'review'}>{document.state}</small></li>
                                    ))}
                                </ul>
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
                            <button type="button" className="officer-reject-button" onClick={requestReject}><XCircle size={17} /> Từ chối nhận hồ sơ</button>
                            <button type="button" className="officer-accept-button" onClick={() => setConfirmAction('accept')}><FileCheck2 size={17} /> Xác nhận nộp hồ sơ</button>
                        </div>
                    </aside>
                </section>
            </main>

            {confirmAction && (
                <div className="officer-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmAction(null); }}>
                    <section className="officer-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="officer-confirm-title">
                        <button type="button" className="officer-modal-close" onClick={() => setConfirmAction(null)} aria-label="Đóng"><X size={18} /></button>
                        <div className={`officer-confirm-icon ${confirmAction}`}>
                            {confirmAction === 'accept' ? <FileCheck2 size={26} /> : <AlertTriangle size={26} />}
                        </div>
                        <h2 id="officer-confirm-title">{confirmAction === 'accept' ? 'Xác nhận nộp hồ sơ?' : 'Từ chối nhận hồ sơ?'}</h2>
                        <p>{confirmAction === 'accept'
                            ? `Hồ sơ ${selectedApplication.id} sẽ được ghi nhận đã tiếp nhận và chuyển sang bước xử lý chuyên môn.`
                            : `Hồ sơ ${selectedApplication.id} sẽ được trả lại cho ${selectedApplication.applicant}.`}</p>
                        {confirmAction === 'reject' && <div className="officer-confirm-reason"><strong>Lý do trả về</strong><span>{returnReason}</span>{message && <><strong>Tin nhắn kèm theo</strong><span>{message}</span></>}</div>}
                        <div className="officer-modal-actions">
                            <button type="button" onClick={() => setConfirmAction(null)}>Hủy</button>
                            <button type="button" className={confirmAction === 'accept' ? 'accept' : 'reject'} onClick={completeAction}>{confirmAction === 'accept' ? <><Send size={16} /> Xác nhận nộp</> : <><XCircle size={16} /> Xác nhận từ chối</>}</button>
                        </div>
                    </section>
                </div>
            )}

            {toast && <div className="officer-toast" role="status"><CheckCircle2 size={18} /> {toast}</div>}
        </div>
    );
};

export default OfficerDashboardPage;
