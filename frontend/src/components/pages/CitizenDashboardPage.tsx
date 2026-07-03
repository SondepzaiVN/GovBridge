import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList, FileSearch, Home, PlusCircle } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';

const CitizenDashboardPage: React.FC = () => {
    const { user } = useAuth();

    return (
        <div className="portal-dashboard">
            <div className="dashboard-heading">
                <div>
                    <span>Khu vực người dân</span>
                    <h1>Xin chào, {user?.name}</h1>
                    <p>Quản lý hồ sơ và thực hiện dịch vụ công trực tuyến.</p>
                </div>
                <Link to="/" className="dashboard-secondary-action"><Home size={17} /> Trang chủ</Link>
            </div>

            <section className="dashboard-summary" aria-label="Tổng quan hồ sơ">
                <article><ClipboardList size={22} /><strong>0</strong><span>Hồ sơ đang xử lý</span></article>
                <article><FileSearch size={22} /><strong>0</strong><span>Hồ sơ cần bổ sung</span></article>
                <article><PlusCircle size={22} /><strong>6</strong><span>Dịch vụ có thể thực hiện</span></article>
            </section>

            <section className="dashboard-panel">
                <div className="dashboard-panel-title"><h2>Thực hiện dịch vụ công</h2><p>Chọn thủ tục cần thực hiện</p></div>
                <div className="dashboard-service-links">
                    <Link to="/lien-thong-khai-sinh"><span>Liên thông khai sinh, thường trú, BHYT</span><ArrowRight size={18} /></Link>
                    <Link to="/lien-thong-khai-tu"><span>Liên thông khai tử</span><ArrowRight size={18} /></Link>
                    <Link to="/xac-nhan-cu-tru"><span>Xác nhận thông tin về cư trú</span><ArrowRight size={18} /></Link>
                    <Link to="/dang-ky-tam-tru"><span>Đăng ký tạm trú</span><ArrowRight size={18} /></Link>
                </div>
            </section>
        </div>
    );
};

export default CitizenDashboardPage;
