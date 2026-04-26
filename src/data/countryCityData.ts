export interface CityEntry {
  en: string;
  ar: string;
}

export interface CountryEntry {
  code: string;
  en: string;
  ar: string;
  cities: CityEntry[];
}

export const COUNTRIES: CountryEntry[] = [
  // Gulf
  {
    code: 'SA', en: 'Saudi Arabia', ar: 'السعودية',
    cities: [
      { en: 'Riyadh', ar: 'الرياض' },
      { en: 'Jeddah', ar: 'جدة' },
      { en: 'Mecca', ar: 'مكة المكرمة' },
      { en: 'Medina', ar: 'المدينة المنورة' },
      { en: 'Dammam', ar: 'الدمام' },
      { en: 'Khobar', ar: 'الخبر' },
      { en: 'Dhahran', ar: 'الظهران' },
      { en: 'Tabuk', ar: 'تبوك' },
      { en: 'Abha', ar: 'أبها' },
      { en: 'Taif', ar: 'الطائف' },
      { en: 'Hail', ar: 'حائل' },
      { en: 'Buraidah', ar: 'بريدة' },
      { en: 'Jubail', ar: 'الجبيل' },
      { en: 'Yanbu', ar: 'ينبع' },
      { en: 'Najran', ar: 'نجران' },
      { en: 'Jazan', ar: 'جازان' },
      { en: 'Al Ahsa', ar: 'الأحساء' },
    ],
  },
  {
    code: 'AE', en: 'United Arab Emirates', ar: 'الإمارات',
    cities: [
      { en: 'Dubai', ar: 'دبي' },
      { en: 'Abu Dhabi', ar: 'أبوظبي' },
      { en: 'Sharjah', ar: 'الشارقة' },
      { en: 'Ajman', ar: 'عجمان' },
      { en: 'Ras Al Khaimah', ar: 'رأس الخيمة' },
      { en: 'Fujairah', ar: 'الفجيرة' },
      { en: 'Umm Al Quwain', ar: 'أم القيوين' },
      { en: 'Al Ain', ar: 'العين' },
    ],
  },
  {
    code: 'KW', en: 'Kuwait', ar: 'الكويت',
    cities: [
      { en: 'Kuwait City', ar: 'مدينة الكويت' },
      { en: 'Hawalli', ar: 'حولي' },
      { en: 'Salmiya', ar: 'السالمية' },
      { en: 'Jahra', ar: 'الجهراء' },
      { en: 'Ahmadi', ar: 'الأحمدي' },
      { en: 'Farwaniya', ar: 'الفروانية' },
    ],
  },
  {
    code: 'BH', en: 'Bahrain', ar: 'البحرين',
    cities: [
      { en: 'Manama', ar: 'المنامة' },
      { en: 'Muharraq', ar: 'المحرق' },
      { en: 'Riffa', ar: 'الرفاع' },
      { en: 'Isa Town', ar: 'مدينة عيسى' },
      { en: 'Hamad Town', ar: 'مدينة حمد' },
    ],
  },
  {
    code: 'QA', en: 'Qatar', ar: 'قطر',
    cities: [
      { en: 'Doha', ar: 'الدوحة' },
      { en: 'Al Wakrah', ar: 'الوكرة' },
      { en: 'Al Khor', ar: 'الخور' },
      { en: 'Lusail', ar: 'لوسيل' },
    ],
  },
  {
    code: 'OM', en: 'Oman', ar: 'عُمان',
    cities: [
      { en: 'Muscat', ar: 'مسقط' },
      { en: 'Salalah', ar: 'صلالة' },
      { en: 'Sohar', ar: 'صحار' },
      { en: 'Nizwa', ar: 'نزوى' },
      { en: 'Sur', ar: 'صور' },
    ],
  },
  // Arab
  {
    code: 'JO', en: 'Jordan', ar: 'الأردن',
    cities: [
      { en: 'Amman', ar: 'عمّان' },
      { en: 'Zarqa', ar: 'الزرقاء' },
      { en: 'Irbid', ar: 'إربد' },
      { en: 'Aqaba', ar: 'العقبة' },
    ],
  },
  {
    code: 'EG', en: 'Egypt', ar: 'مصر',
    cities: [
      { en: 'Cairo', ar: 'القاهرة' },
      { en: 'Alexandria', ar: 'الإسكندرية' },
      { en: 'Giza', ar: 'الجيزة' },
      { en: 'Sharm El Sheikh', ar: 'شرم الشيخ' },
      { en: 'Luxor', ar: 'الأقصر' },
      { en: 'Aswan', ar: 'أسوان' },
    ],
  },
  {
    code: 'IQ', en: 'Iraq', ar: 'العراق',
    cities: [
      { en: 'Baghdad', ar: 'بغداد' },
      { en: 'Basra', ar: 'البصرة' },
      { en: 'Erbil', ar: 'أربيل' },
      { en: 'Mosul', ar: 'الموصل' },
      { en: 'Sulaymaniyah', ar: 'السليمانية' },
    ],
  },
  {
    code: 'SY', en: 'Syria', ar: 'سوريا',
    cities: [
      { en: 'Damascus', ar: 'دمشق' },
      { en: 'Aleppo', ar: 'حلب' },
      { en: 'Homs', ar: 'حمص' },
      { en: 'Latakia', ar: 'اللاذقية' },
    ],
  },
  {
    code: 'LB', en: 'Lebanon', ar: 'لبنان',
    cities: [
      { en: 'Beirut', ar: 'بيروت' },
      { en: 'Tripoli', ar: 'طرابلس' },
      { en: 'Sidon', ar: 'صيدا' },
      { en: 'Jounieh', ar: 'جونية' },
    ],
  },
  {
    code: 'YE', en: 'Yemen', ar: 'اليمن',
    cities: [
      { en: "Sana'a", ar: 'صنعاء' },
      { en: 'Aden', ar: 'عدن' },
      { en: 'Taiz', ar: 'تعز' },
    ],
  },
  {
    code: 'LY', en: 'Libya', ar: 'ليبيا',
    cities: [
      { en: 'Tripoli', ar: 'طرابلس' },
      { en: 'Benghazi', ar: 'بنغازي' },
      { en: 'Misrata', ar: 'مصراتة' },
    ],
  },
  {
    code: 'TN', en: 'Tunisia', ar: 'تونس',
    cities: [
      { en: 'Tunis', ar: 'تونس العاصمة' },
      { en: 'Sfax', ar: 'صفاقس' },
      { en: 'Sousse', ar: 'سوسة' },
    ],
  },
  {
    code: 'DZ', en: 'Algeria', ar: 'الجزائر',
    cities: [
      { en: 'Algiers', ar: 'الجزائر العاصمة' },
      { en: 'Oran', ar: 'وهران' },
      { en: 'Constantine', ar: 'قسنطينة' },
    ],
  },
  {
    code: 'MA', en: 'Morocco', ar: 'المغرب',
    cities: [
      { en: 'Casablanca', ar: 'الدار البيضاء' },
      { en: 'Rabat', ar: 'الرباط' },
      { en: 'Marrakech', ar: 'مراكش' },
      { en: 'Fes', ar: 'فاس' },
      { en: 'Tangier', ar: 'طنجة' },
    ],
  },
  {
    code: 'SD', en: 'Sudan', ar: 'السودان',
    cities: [
      { en: 'Khartoum', ar: 'الخرطوم' },
      { en: 'Omdurman', ar: 'أم درمان' },
      { en: 'Port Sudan', ar: 'بورتسودان' },
    ],
  },
  {
    code: 'PS', en: 'Palestine', ar: 'فلسطين',
    cities: [
      { en: 'Gaza', ar: 'غزة' },
      { en: 'Ramallah', ar: 'رام الله' },
      { en: 'Nablus', ar: 'نابلس' },
      { en: 'Hebron', ar: 'الخليل' },
    ],
  },
  // International
  {
    code: 'US', en: 'United States', ar: 'الولايات المتحدة',
    cities: [
      { en: 'New York', ar: 'نيويورك' },
      { en: 'Los Angeles', ar: 'لوس أنجلوس' },
      { en: 'Chicago', ar: 'شيكاغو' },
      { en: 'Houston', ar: 'هيوستن' },
      { en: 'Miami', ar: 'ميامي' },
    ],
  },
  {
    code: 'GB', en: 'United Kingdom', ar: 'المملكة المتحدة',
    cities: [
      { en: 'London', ar: 'لندن' },
      { en: 'Manchester', ar: 'مانشستر' },
      { en: 'Birmingham', ar: 'برمنغهام' },
      { en: 'Edinburgh', ar: 'إدنبرة' },
    ],
  },
  {
    code: 'TR', en: 'Turkey', ar: 'تركيا',
    cities: [
      { en: 'Istanbul', ar: 'إسطنبول' },
      { en: 'Ankara', ar: 'أنقرة' },
      { en: 'Izmir', ar: 'إزمير' },
      { en: 'Antalya', ar: 'أنطاليا' },
    ],
  },
  {
    code: 'DE', en: 'Germany', ar: 'ألمانيا',
    cities: [
      { en: 'Berlin', ar: 'برلين' },
      { en: 'Munich', ar: 'ميونخ' },
      { en: 'Frankfurt', ar: 'فرانكفورت' },
      { en: 'Hamburg', ar: 'هامبورغ' },
    ],
  },
  {
    code: 'FR', en: 'France', ar: 'فرنسا',
    cities: [
      { en: 'Paris', ar: 'باريس' },
      { en: 'Marseille', ar: 'مارسيليا' },
      { en: 'Lyon', ar: 'ليون' },
    ],
  },
];

export const OTHER_OPTION: CityEntry = { en: 'Other', ar: 'أخرى' };

/**
 * Resolve a stored city string (either English or Arabic label from our list) to the
 * display label for the current UI language.
 */
export function getCityDisplayLabel(countryCode: string, storedCity: string, useArabic: boolean): string {
  const code = countryCode.trim();
  const raw = storedCity.trim();
  if (!raw) return '';
  const country = COUNTRIES.find((c) => c.code === code);
  if (!country) return raw;
  const entry = country.cities.find((city) => city.en === raw || city.ar === raw);
  if (!entry) return raw;
  return useArabic ? entry.ar : entry.en;
}
