import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Search, ChevronRight, ArrowRight } from 'lucide-react';
import { PUBLIC_SERVICES } from '../../data/services';

const HomePage: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredServices = PUBLIC_SERVICES.filter(
        (s) =>
            !searchQuery ||
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.keywords.some((k) => k.includes(searchQuery.toLowerCase())),
    );

    return (
        <div className="main-content animate-fade-in">
            {/* Hero Section */}
            <section className="home-hero" aria-label="Giới thiệu">
                <div className="home-hero-content">
                    <div className="home-hero-badge" role="note">
                        Hỗ trợ bởi AI VNPT — Thông minh & Tiện lợi
                    </div>

                    <h1>
                        Dịch Vụ Công
                        <br />
                        Trực Tuyến Thông Minh
                    </h1>
                    <p>
                        Thực hiện thủ tục hành chính nhanh chóng với sự hỗ trợ của Trợ lý AI. Tự động điền form, hướng
                        dẫn từng bước, xác thực thông tin tức thì.
                    </p>

                    {/* Search bar */}
                    <div className="home-hero-search" role="search">
                        <label htmlFor="service-search" className="sr-only">
                            Tìm kiếm dịch vụ
                        </label>
                        <input
                            id="service-search"
                            type="search"
                            placeholder="Tìm dịch vụ... (vd: khai sinh, hộ khẩu, CCCD)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            aria-label="Tìm kiếm dịch vụ công"
                            data-highlight-id="search-bar"
                        />
                        <button type="button" aria-label="Tìm kiếm" data-highlight-id="search-btn">
                            <Search size={16} />
                            Tìm kiếm
                        </button>
                    </div>
                </div>
            </section>

            {/* Services Grid */}
            <section aria-label="Danh sách dịch vụ">
                <h2 className="home-section-title">Dịch Vụ Phổ Biến</h2>

                {filteredServices.length === 0 ? (
                    <div
                        style={{
                            textAlign: 'center',
                            padding: '48px',
                            color: 'var(--text-secondary)',
                        }}
                    >
                        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔍</div>
                        <p>Không tìm thấy dịch vụ phù hợp với "{searchQuery}"</p>
                        <p style={{ marginTop: 8, fontSize: '0.875rem' }}>
                            Bạn có thể hỏi Trợ lý AI để được hướng dẫn thêm!
                        </p>
                    </div>
                ) : (
                    <div className="services-grid">
                        {filteredServices.map((service) => (
                            <NavLink
                                key={service.id}
                                to={service.route}
                                className="service-card"
                                data-highlight-id={`service-${service.id}`}
                                aria-label={`${service.name} - ${service.description}`}
                            >
                                {/* <div className="service-card-icon" aria-hidden="true">
                  {service.icon}
                </div> */}

                                <div>
                                    <div className="service-card-name">{service.name}</div>
                                    <div className="service-card-desc">{service.description}</div>
                                </div>

                                <div className="service-card-arrow" aria-hidden="true">
                                    <ArrowRight size={18} />
                                </div>
                            </NavLink>
                        ))}
                    </div>
                )}
            </section>

            {/* AI Chatbot Banner */}
            <section
                style={{
                    background: 'linear-gradient(135deg, #FFF3EE 0%, #FFF8F5 100%)',
                    border: '2px solid #C8441A',
                    borderRadius: 'var(--radius-xl)',
                    padding: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '24px',
                    marginTop: '8px',
                }}
                aria-label="Trợ lý AI"
                data-highlight-id="ai-banner"
            >
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img
                        src="/logo_Gov_Bridge.jpg"
                        alt="Gov Bridge AI"
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid #C8441A',
                            padding: 2,
                            background: 'white',
                        }}
                    />
                </div>
                <div style={{ flex: 1 }}>
                    <h2
                        style={{
                            fontSize: '1.125rem',
                            fontWeight: 800,
                            color: '#8B1A1A',
                            marginBottom: 6,
                        }}
                    >
                        Trợ lý AI Dịch Vụ Công — Sẵn sàng 24/7
                    </h2>
                    <p
                        style={{
                            fontSize: '0.875rem',
                            color: 'var(--text-secondary)',
                            lineHeight: 1.6,
                        }}
                    >
                        Nhấn nút{' '}
                        <strong>
                            <img
                                src="/logo_Gov_Bridge.jpg"
                                alt="AI"
                                style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    verticalAlign: 'middle',
                                    marginRight: 4,
                                    display: 'inline-block',
                                    border: '1px solid #C8441A',
                                }}
                            />{' '}
                            Trợ lý AI
                        </strong>{' '}
                        ở góc phải màn hình để được hướng dẫn, tự động điền form bằng giọng nói hoặc ảnh CCCD, và nhiều
                        tính năng thông minh khác!
                    </p>
                </div>
                <ChevronRight size={24} color="#C8441A" style={{ flexShrink: 0 }} />
            </section>
        </div>
    );
};

export default HomePage;
