import React from 'react';
import { SERVICE_MAP } from '../../data/services';
import ServicePageLayout from './ServicePageLayout';

const KetHonPage: React.FC = () => (
  <ServicePageLayout
    service={SERVICE_MAP['ket-hon']}
    categoryLabel="Hộ tịch"
    cccdOcrActions={[
      {
        id: 'male',
        label: 'Thông tin bên Nam',
        insertBeforeFieldId: 'hoTenNam',
        fieldMap: {
          hoTenNam: 'hoTen',
          cccdNam: 'id',
          ngaySinhNam: 'ngaySinh',
          diaChiNam: 'thuongTru',
        },
      },
      {
        id: 'female',
        label: 'Thông tin bên Nữ',
        insertBeforeFieldId: 'hoTenNu',
        fieldMap: {
          hoTenNu: 'hoTen',
          cccdNu: 'id',
          ngaySinhNu: 'ngaySinh',
          diaChiNu: 'thuongTru',
        },
      },
    ]}
  />
);

export default KetHonPage;
