import React from 'react';
import { SERVICE_MAP } from '../../data/services';
import ServicePageLayout from './ServicePageLayout';

const KetHonPage: React.FC = () => (
  <ServicePageLayout
    service={SERVICE_MAP['ket-hon']}
    categoryLabel="Hộ tịch"
  />
);

export default KetHonPage;
