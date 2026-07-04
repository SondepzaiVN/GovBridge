import React from 'react';
import { SERVICE_MAP } from '../../data/services';
import ServicePageLayout from './ServicePageLayout';

const KhaiSinhPage: React.FC = () => (
  <ServicePageLayout
    service={SERVICE_MAP['khai-sinh']}
    categoryLabel="Hộ tịch"
    cccdOcrActions={[
      {
        id: 'father',
        label: 'Thông tin cha',
        insertBeforeFieldId: 'cccdCha',
        fieldMap: {
          cccdCha: 'id',
          hoTenCha: 'hoTen',
          ngaySinhCha: 'ngaySinh',
        },
      },
      {
        id: 'mother',
        label: 'Thông tin mẹ',
        insertBeforeFieldId: 'cccdMe',
        fieldMap: {
          cccdMe: 'id',
          hoTenMe: 'hoTen',
          ngaySinhMe: 'ngaySinh',
        },
      },
    ]}
  />
);

export default KhaiSinhPage;
