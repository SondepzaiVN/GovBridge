import React, { useState } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { LogIn, Home, ChevronDown, LogOut, Menu, UserPlus, UserRound, X } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';

type MobileNavSection = 'ho-tich' | 'cu-tru';

const Header: React.FC = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mobileNavSection, setMobileNavSection] = useState<MobileNavSection | null>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    const closeMobileMenu = () => {
        setMobileMenuOpen(false);
        setMobileNavSection(null);
    };

    const toggleMobileMenu = () => {
        setMobileMenuOpen((isOpen) => !isOpen);
        setMobileNavSection(null);
    };

    const toggleMobileSection = (section: MobileNavSection) => {
        setMobileNavSection((current) => current === section ? null : section);
    };

    const handleLogout = () => {
        closeMobileMenu();
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
                                <Link
                                    to={user.role === 'can-bo' ? '/can-bo' : '/nguoi-dan'}
                                    className="header-user"
                                    aria-label="Mở khu vực tài khoản"
                                >
                                    <UserRound size={20} />
                                    <span>
                                        <strong>{user.name}</strong>
                                        <small>{user.role === 'can-bo' ? 'Cán bộ' : 'Hồ sơ của tôi'}</small>
                                    </span>
                                </Link>
                                <button
                                    className="btn-header-logout"
                                    type="button"
                                    onClick={handleLogout}
                                    aria-label="Đăng xuất"
                                >
                                    <LogOut size={15} />
                                    <span>Đăng xuất</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    className="btn-header-register"
                                    to="/dang-nhap?role=nguoi-dan"
                                    aria-label="Đăng ký tài khoản"
                                >
                                    <UserPlus size={15} />
                                    <span>Đăng ký</span>
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
            {user?.role !== 'can-bo' && (
                <>
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
                                    <button
                                        type="button"
                                        className={[
                                            'header-nav-link',
                                            'header-nav-link--parent',
                                            ['/khai-sinh', '/lien-thong-khai-sinh', '/lien-thong-khai-tu'].some((p) =>
                                                location.pathname.startsWith(p),
                                            )
                                                ? 'active'
                                                : '',
                                        ]
                                            .filter(Boolean)
                                            .join(' ')}
                                        data-highlight-id="nav-khai-sinh"
                                        aria-haspopup="true"
                                        aria-label="Dịch vụ Hộ Tịch"
                                    >
                                        Hộ Tịch <ChevronDown size={13} />
                                    </button>
                                    <div className="header-dropdown" role="menu" aria-label="Dịch vụ hộ tịch">
                                        <NavLink to="/khai-sinh" className="header-dropdown-link" role="menuitem">
                                            Đăng ký khai sinh
                                        </NavLink>
                                        <NavLink
                                            to="/lien-thong-khai-sinh"
                                            className="header-dropdown-link"
                                            role="menuitem"
                                        >
                                            Liên thông khai sinh
                                        </NavLink>
                                        <NavLink
                                            to="/lien-thong-khai-tu"
                                            className="header-dropdown-link"
                                            role="menuitem"
                                        >
                                            Liên thông khai tử
                                        </NavLink>
                                    </div>
                                </div>
                                <div className="header-nav-item has-dropdown">
                                    <button
                                        type="button"
                                        className={[
                                            'header-nav-link',
                                            'header-nav-link--parent',
                                            [
                                                '/ho-khau',
                                                '/dang-ky-thuong-tru',
                                                '/dang-ky-tam-tru',
                                                '/tam-tru',
                                                '/xac-nhan-cu-tru',
                                            ].some((p) => location.pathname.startsWith(p))
                                                ? 'active'
                                                : '',
                                        ]
                                            .filter(Boolean)
                                            .join(' ')}
                                        data-highlight-id="nav-ho-khau"
                                        aria-haspopup="true"
                                        aria-label="Dịch vụ Cư Trú"
                                    >
                                        Cư Trú <ChevronDown size={13} />
                                    </button>
                                    <div className="header-dropdown" role="menu" aria-label="Dịch vụ cư trú">
                                        <NavLink to="/ho-khau" className="header-dropdown-link" role="menuitem">
                                            Đăng ký thường trú
                                        </NavLink>
                                        <NavLink to="/dang-ky-tam-tru" className="header-dropdown-link" role="menuitem">
                                            Đăng ký tạm trú
                                        </NavLink>
                                        <NavLink to="/xac-nhan-cu-tru" className="header-dropdown-link" role="menuitem">
                                            Xác nhận thông tin cư trú
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
                                type="button"
                                onClick={toggleMobileMenu}
                                aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
                                aria-expanded={mobileMenuOpen}
                                aria-controls="mobile-navigation"
                            >
                                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                            </button>
                        </div>
                    </div>

                    {/* ── Mobile dropdown menu ── */}
                    {mobileMenuOpen && (
                        <div className="header-mobile-menu" id="mobile-navigation">
                            <NavLink to="/" end className="mobile-nav-link" onClick={closeMobileMenu}>
                                Trang Chủ
                            </NavLink>

                            <div className="mobile-nav-group">
                                <button
                                    type="button"
                                    className={[
                                        'mobile-nav-link',
                                        'mobile-nav-parent',
                                        ['/khai-sinh', '/lien-thong-khai-sinh', '/lien-thong-khai-tu'].some(
                                            (path) => location.pathname.startsWith(path)
                                        ) ? 'active' : '',
                                        mobileNavSection === 'ho-tich' ? 'open' : '',
                                    ].filter(Boolean).join(' ')}
                                    onClick={() => toggleMobileSection('ho-tich')}
                                    aria-expanded={mobileNavSection === 'ho-tich'}
                                    aria-controls="mobile-ho-tich-menu"
                                >
                                    <span>Hộ Tịch</span>
                                    <ChevronDown className="mobile-nav-chevron" size={17} />
                                </button>
                                <div
                                    className={`mobile-nav-submenu${mobileNavSection === 'ho-tich' ? ' open' : ''}`}
                                    id="mobile-ho-tich-menu"
                                >
                                    <div className="mobile-nav-submenu-inner">
                                        <NavLink to="/khai-sinh" className="mobile-nav-link mobile-nav-link-child" onClick={closeMobileMenu}>
                                            Đăng ký khai sinh
                                        </NavLink>
                                        <NavLink to="/lien-thong-khai-sinh" className="mobile-nav-link mobile-nav-link-child" onClick={closeMobileMenu}>
                                            Liên thông khai sinh
                                        </NavLink>
                                        <NavLink to="/lien-thong-khai-tu" className="mobile-nav-link mobile-nav-link-child" onClick={closeMobileMenu}>
                                            Liên thông khai tử
                                        </NavLink>
                                    </div>
                                </div>
                            </div>

                            <div className="mobile-nav-group">
                                <button
                                    type="button"
                                    className={[
                                        'mobile-nav-link',
                                        'mobile-nav-parent',
                                        ['/ho-khau', '/dang-ky-thuong-tru', '/dang-ky-tam-tru', '/tam-tru', '/xac-nhan-cu-tru'].some(
                                            (path) => location.pathname.startsWith(path)
                                        ) ? 'active' : '',
                                        mobileNavSection === 'cu-tru' ? 'open' : '',
                                    ].filter(Boolean).join(' ')}
                                    onClick={() => toggleMobileSection('cu-tru')}
                                    aria-expanded={mobileNavSection === 'cu-tru'}
                                    aria-controls="mobile-cu-tru-menu"
                                >
                                    <span>Cư Trú</span>
                                    <ChevronDown className="mobile-nav-chevron" size={17} />
                                </button>
                                <div
                                    className={`mobile-nav-submenu${mobileNavSection === 'cu-tru' ? ' open' : ''}`}
                                    id="mobile-cu-tru-menu"
                                >
                                    <div className="mobile-nav-submenu-inner">
                                        <NavLink to="/ho-khau" className="mobile-nav-link mobile-nav-link-child" onClick={closeMobileMenu}>
                                            Đăng ký thường trú
                                        </NavLink>
                                        <NavLink to="/dang-ky-tam-tru" className="mobile-nav-link mobile-nav-link-child" onClick={closeMobileMenu}>
                                            Đăng ký tạm trú
                                        </NavLink>
                                        <NavLink to="/xac-nhan-cu-tru" className="mobile-nav-link mobile-nav-link-child" onClick={closeMobileMenu}>
                                            Hồ sơ xác nhận thông tin cư trú
                                        </NavLink>
                                    </div>
                                </div>
                            </div>

                            <NavLink to="/cccd" className="mobile-nav-link" onClick={closeMobileMenu}>
                                Căn Cước
                            </NavLink>
                            <NavLink to="/ket-hon" className="mobile-nav-link" onClick={closeMobileMenu}>
                                Kết Hôn
                            </NavLink>
                        </div>
                    )}
                </>
            )}
        </header>
    );
};

export default Header;
