import React from 'react';
import { SERVICE_MAP } from '../../data/services';
import ServicePageLayout from './ServicePageLayout';

const CCCDPage: React.FC = () => (
  <ServicePageLayout
    service={SERVICE_MAP['cccd']}
    categoryLabel="Căn cước"
  />
);

export default CCCDPage;
