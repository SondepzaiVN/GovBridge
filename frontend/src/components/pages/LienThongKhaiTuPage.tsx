import React from 'react';
import { SERVICE_MAP } from '../../data/services';
import ServicePageLayout from './ServicePageLayout';

const LienThongKhaiTuPage: React.FC = () => (
  <ServicePageLayout
    service={SERVICE_MAP['lien-thong-khai-tu']}
    categoryLabel="Dịch vụ công liên thông"
  />
);

export default LienThongKhaiTuPage;
