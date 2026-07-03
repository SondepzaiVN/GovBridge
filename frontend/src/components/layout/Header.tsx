import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { LogIn, Home, ChevronDown, LogOut, UserPlus, UserRound } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';

const Header: React.FC = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const handleLogout = () => {
        setMobileMenuOpen(false);
        logout();
        window.setTimeout(() => navigate('/', { replace: true }), 0);
    };

    return (
        <header className="app-header" role="banner">
            {/* ── Top white bar: Logo + Title + Login ── */}
            <div className="header-top-bar">
                <div className="header-inner">
                    {/* Tên cổng */}
                    <Link to="/" className="header-logo" aria-label="Cổng Dịch Vụ Công Quốc Gia - Trang chủ">
                        <img src="/quoc_huy.png" alt="Quốc huy Việt Nam" className="header-quoc-huy" />
                        <div className="header-logo-text">
                            <span className="header-logo-name">Cổng Dịch Vụ Công Quốc Gia</span>
                            <span className="header-logo-sub">
                                Kết nối, cung cấp thông tin và dịch vụ công mọi lúc, mọi nơi
                            </span>
                        </div>
                    </Link>

                    {/* Right: Login */}
                    <div className="header-actions">
                        {user ? (
                            <>
                                <Link to={user.role === 'can-bo' ? '/can-bo' : '/nguoi-dan'} className="header-user" aria-label="Mở khu vực tài khoản">
                                    <UserRound size={20} />
                                    <span><strong>{user.name}</strong><small>{user.role === 'can-bo' ? 'Cán bộ' : 'Người dân'}</small></span>
                                </Link>
                                <button className="btn-header-logout" type="button" onClick={handleLogout} aria-label="Đăng xuất">
                                    <LogOut size={15} /><span>Đăng xuất</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <Link className="btn-header-register" to="/dang-nhap?role=nguoi-dan" aria-label="Đăng ký tài khoản">
                                    <UserPlus size={15} /><span>Đăng ký</span>
                                </Link>
                                <Link
                                    className="btn-header-login"
                                    id="login-btn"
                                    data-highlight-id="login-btn"
                                    aria-label="Đăng nhập tài khoản"
                                    to="/dang-nhap"
                                >
                                    <LogIn size={15} />
                                    <span>Đăng nhập</span>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Orange navigation bar ── */}
            <div className="header-nav-bar">
                <div className="header-nav-inner">
                    <nav className="header-nav" role="navigation" aria-label="Menu chính">
                        <NavLink
                            to="/"
                            end
                            className={({ isActive }) => `header-nav-link${isActive ? ' active' : ''}`}
                            data-highlight-id="nav-home"
                            aria-label="Trang chủ"
                        >
                            <Home size={15} />
                        </NavLink>
                        <div className="header-nav-item has-dropdown">
                            <NavLink
                                to="/khai-sinh"
                                className={({ isActive }) => `header-nav-link${isActive ? ' active' : ''}`}
                                data-highlight-id="nav-khai-sinh"
                            >
                                Hộ Tịch <ChevronDown size={13} />
                            </NavLink>
                            <div className="header-dropdown" role="menu" aria-label="Dịch vụ hộ tịch">
                                <NavLink to="/khai-sinh" className="header-dropdown-link" role="menuitem">
                                    Đăng ký khai sinh
                                </NavLink>
                                <NavLink to="/lien-thong-khai-sinh" className="header-dropdown-link" role="menuitem">
                                    Liên thông khai sinh
                                </NavLink>
                                <NavLink to="/lien-thong-khai-tu" className="header-dropdown-link" role="menuitem">
                                    Liên thông khai tử
                                </NavLink>
                            </div>
                        </div>
                        <div className="header-nav-item has-dropdown">
                            <NavLink
                                to="/ho-khau"
                                className={({ isActive }) => `header-nav-link${isActive ? ' active' : ''}`}
                                data-highlight-id="nav-ho-khau"
                            >
                                Cư Trú <ChevronDown size={13} />
                            </NavLink>
                            <div className="header-dropdown" role="menu" aria-label="Dịch vụ cư trú">
                                <NavLink to="/ho-khau" className="header-dropdown-link" role="menuitem">
                                    Đăng ký thường trú
                                </NavLink>
                                <NavLink to="/dang-ky-tam-tru" className="header-dropdown-link" role="menuitem">
                                    Đăng ký tạm trú
                                </NavLink>
                                <NavLink to="/xac-nhan-cu-tru" className="header-dropdown-link" role="menuitem">
                                    Hồ sơ xác nhận thông tin cư trú
                                </NavLink>
                            </div>
                        </div>
                        <NavLink
                            to="/cccd"
                            className={({ isActive }) => `header-nav-link${isActive ? ' active' : ''}`}
                            data-highlight-id="nav-cccd"
                        >
                            Căn Cước
                        </NavLink>
                        <NavLink
                            to="/ket-hon"
                            className={({ isActive }) => `header-nav-link${isActive ? ' active' : ''}`}
                            data-highlight-id="nav-ket-hon"
                        >
                            Kết Hôn
                        </NavLink>
                    </nav>

                    {/* Mobile menu toggle */}
                    <button
                        className="header-mobile-menu-btn"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="Mở menu"
                    >
                        ☰
                    </button>
                </div>
            </div>

            {/* ── Mobile dropdown menu ── */}
            {mobileMenuOpen && (
                <div className="header-mobile-menu">
                    <NavLink to="/" end className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                        Trang Chủ
                    </NavLink>
                    <NavLink to="/khai-sinh" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                        Đăng ký khai sinh
                    </NavLink>
                    <NavLink
                        to="/lien-thong-khai-sinh"
                        className="mobile-nav-link mobile-nav-link-child"
                        onClick={() => setMobileMenuOpen(false)}
                    >
                        Liên thông khai sinh
                    </NavLink>
                    <NavLink
                        to="/lien-thong-khai-tu"
                        className="mobile-nav-link mobile-nav-link-child"
                        onClick={() => setMobileMenuOpen(false)}
                    >
                        Liên thông khai tử
                    </NavLink>
                    <NavLink to="/ho-khau" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                        Đăng ký thường trú
                    </NavLink>
                    <NavLink
                        to="/dang-ky-tam-tru"
                        className="mobile-nav-link mobile-nav-link-child"
                        onClick={() => setMobileMenuOpen(false)}
                    >
                        Đăng ký tạm trú
                    </NavLink>
                    <NavLink
                        to="/xac-nhan-cu-tru"
                        className="mobile-nav-link mobile-nav-link-child"
                        onClick={() => setMobileMenuOpen(false)}
                    >
                        Hồ sơ xác nhận thông tin cư trú
                    </NavLink>
                    <NavLink to="/cccd" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                        Căn Cước
                    </NavLink>
                    <NavLink to="/ket-hon" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                        Kết Hôn
                    </NavLink>
                </div>
            )}
        </header>
    );
};

export default Header;
