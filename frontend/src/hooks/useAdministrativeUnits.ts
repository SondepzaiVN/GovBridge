import { useState, useEffect } from 'react';
import { administrativeUnitService } from '../api/administrativeUnitService';

export const provinces = [
  'Thành phố Hà Nội',
  'Tỉnh Cao Bằng',
  'Tỉnh Tuyên Quang',
  'Tỉnh Điện Biên',
  'Tỉnh Lai Châu',
  'Tỉnh Sơn La',
  'Tỉnh Lào Cai',
  'Tỉnh Thái Nguyên',
  'Tỉnh Lạng Sơn',
  'Tỉnh Quảng Ninh',
  'Tỉnh Bắc Ninh',
  'Tỉnh Phú Thọ',
  'Thành phố Hải Phòng',
  'Tỉnh Hưng Yên',
  'Tỉnh Ninh Bình',
  'Tỉnh Thanh Hóa',
  'Tỉnh Nghệ An',
  'Tỉnh Hà Tĩnh',
  'Tỉnh Quảng Trị',
  'Thành phố Huế',
  'Thành phố Đà Nẵng',
  'Tỉnh Quảng Ngãi',
  'Tỉnh Gia Lai',
  'Tỉnh Khánh Hòa',
  'Tỉnh Đắk Lắk',
  'Tỉnh Lâm Đồng',
  'Thành phố Đồng Nai',
  'Thành phố Hồ Chí Minh',
  'Tỉnh Tây Ninh',
  'Tỉnh Đồng Tháp',
  'Tỉnh Vĩnh Long',
  'Tỉnh An Giang',
  'Thành phố Cần Thơ',
  'Tỉnh Cà Mau',
];

export const provinceCodeByName: Record<string, string> = {
  'Thành phố Hà Nội': '01',
  'Tỉnh Cao Bằng': '04',
  'Tỉnh Tuyên Quang': '08',
  'Tỉnh Điện Biên': '11',
  'Tỉnh Lai Châu': '12',
  'Tỉnh Sơn La': '14',
  'Tỉnh Lào Cai': '15',
  'Tỉnh Thái Nguyên': '19',
  'Tỉnh Lạng Sơn': '20',
  'Tỉnh Quảng Ninh': '22',
  'Tỉnh Bắc Ninh': '24',
  'Tỉnh Phú Thọ': '25',
  'Thành phố Hải Phòng': '31',
  'Tỉnh Hưng Yên': '33',
  'Tỉnh Ninh Bình': '37',
  'Tỉnh Thanh Hóa': '38',
  'Tỉnh Nghệ An': '40',
  'Tỉnh Hà Tĩnh': '42',
  'Tỉnh Quảng Trị': '44',
  'Thành phố Huế': '46',
  'Thành phố Đà Nẵng': '48',
  'Tỉnh Quảng Ngãi': '51',
  'Tỉnh Gia Lai': '52',
  'Tỉnh Khánh Hòa': '56',
  'Tỉnh Đắk Lắk': '66',
  'Tỉnh Lâm Đồng': '68',
  'Thành phố Đồng Nai': '75',
  'Tỉnh Đồng Nai': '75',
  'Thành phố Hồ Chí Minh': '79',
  'Tỉnh Tây Ninh': '80',
  'Tỉnh Đồng Tháp': '82',
  'Tỉnh Vĩnh Long': '86',
  'Tỉnh An Giang': '91',
  'Thành phố Cần Thơ': '92',
  'Tỉnh Cà Mau': '96',
};

export const getResidenceAgencyName = (wardName: string): string => (
  wardName ? `Công an ${wardName}` : 'Cơ quan X'
);

export const getKhaiSinhAgencyName = (wardName: string): string => (
  wardName ? `UBND ${wardName}` : 'Cơ quan X'
);

export const getBhytAgencyName = (wardName: string): string => (
  wardName ? `Bảo hiểm xã hội (theo ${wardName})` : 'Cơ quan X'
);

export const useWards = (provinceName: string | undefined) => {
  const [wardOptions, setWardOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const provinceCode = provinceCodeByName[provinceName || ''];

    if (!provinceCode) {
      setWardOptions([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    administrativeUnitService.getWards(provinceCode, controller.signal)
      .then((options) => setWardOptions(options.map((option) => option.label)))
      .catch((error) => {
        if (error.name !== 'AbortError') setWardOptions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [provinceName]);

  return { wardOptions, loading };
};
