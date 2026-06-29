import React from 'react';
import { SERVICE_MAP } from '../../data/services';
import ServicePageLayout from './ServicePageLayout';

const KhaiSinhPage: React.FC = () => <ServicePageLayout service={SERVICE_MAP['khai-sinh']} categoryLabel="Hộ tịch" />;

export default KhaiSinhPage;
