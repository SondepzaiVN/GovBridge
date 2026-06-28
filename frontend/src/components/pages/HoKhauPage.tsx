import React from 'react';
import { SERVICE_MAP } from '../../data/services';
import ServicePageLayout from './ServicePageLayout';

const HoKhauPage: React.FC = () => (
  <ServicePageLayout
    service={SERVICE_MAP['ho-khau']}
    categoryLabel="Cư trú"
  />
);

export default HoKhauPage;
