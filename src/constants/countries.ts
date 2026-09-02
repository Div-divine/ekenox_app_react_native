export interface CountryData {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
  region: 'EU' | 'NA' | 'AF' | 'AS' | 'ME' | 'SA' | 'OC';
  example: string;
}

export const COUNTRIES: CountryData[] = [
  { name: 'France', code: 'FR', dialCode: '+33', flag: '🇫🇷', region: 'EU', example: '6 12 34 56 78' },
  { name: 'United States', code: 'US', dialCode: '+1', flag: '🇺🇸', region: 'NA', example: '202 555 0123' },
  { name: 'Canada', code: 'CA', dialCode: '+1', flag: '🇨🇦', region: 'NA', example: '416 555 0123' },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44', flag: '🇬🇧', region: 'EU', example: '7911 123456' },
  { name: 'Cameroon', code: 'CM', dialCode: '+237', flag: '🇨🇲', region: 'AF', example: '6 71 23 45 67' },
  { name: 'Nigeria', code: 'NG', dialCode: '+234', flag: '🇳🇬', region: 'AF', example: '803 123 4567' },
  { name: 'Ivory Coast', code: 'CI', dialCode: '+225', flag: '🇨🇮', region: 'AF', example: '07 01 23 45 67' },
  { name: 'Senegal', code: 'SN', dialCode: '+221', flag: '🇸🇳', region: 'AF', example: '77 123 45 67' },
  { name: 'Germany', code: 'DE', dialCode: '+49', flag: '🇩🇪', region: 'EU', example: '151 23456789' },
  { name: 'Belgium', code: 'BE', dialCode: '+32', flag: '🇧🇪', region: 'EU', example: '470 12 34 56' },
  { name: 'Switzerland', code: 'CH', dialCode: '+41', flag: '🇨🇭', region: 'EU', example: '79 123 45 67' },
  { name: 'Spain', code: 'ES', dialCode: '+34', flag: '🇪🇸', region: 'EU', example: '612 34 56 78' },
  { name: 'Italy', code: 'IT', dialCode: '+39', flag: '🇮🇹', region: 'EU', example: '312 345 6789' },
  { name: 'Netherlands', code: 'NL', dialCode: '+31', flag: '🇳🇱', region: 'EU', example: '6 12345678' },
  { name: 'Portugal', code: 'PT', dialCode: '+351', flag: '🇵🇹', region: 'EU', example: '912 345 678' },
  { name: 'Morocco', code: 'MA', dialCode: '+212', flag: '🇲🇦', region: 'AF', example: '6 12 34 56 78' },
  { name: 'Algeria', code: 'DZ', dialCode: '+213', flag: '🇩🇿', region: 'AF', example: '550 12 34 56' },
  { name: 'Tunisia', code: 'TN', dialCode: '+216', flag: '🇹🇳', region: 'AF', example: '20 123 456' },
  { name: 'Ghana', code: 'GH', dialCode: '+233', flag: '🇬🇭', region: 'AF', example: '24 123 4567' },
  { name: 'Kenya', code: 'KE', dialCode: '+254', flag: '🇰🇪', region: 'AF', example: '712 345 678' },
  { name: 'South Africa', code: 'ZA', dialCode: '+27', flag: '🇿🇦', region: 'AF', example: '71 123 4567' },
  { name: 'India', code: 'IN', dialCode: '+91', flag: '🇮🇳', region: 'AS', example: '98765 43210' },
  { name: 'United Arab Emirates', code: 'AE', dialCode: '+971', flag: '🇦🇪', region: 'ME', example: '50 123 4567' },
  { name: 'Brazil', code: 'BR', dialCode: '+55', flag: '🇧🇷', region: 'SA', example: '11 91234 5678' },
  { name: 'Australia', code: 'AU', dialCode: '+61', flag: '🇦🇺', region: 'OC', example: '412 345 678' },
  { name: 'Benin', code: 'BJ', dialCode: '+229', flag: '🇧🇯', region: 'AF', example: '97 12 34 56' },
  { name: 'Togo', code: 'TG', dialCode: '+228', flag: '🇹🇬', region: 'AF', example: '90 12 34 56' },
  { name: 'Gabon', code: 'GA', dialCode: '+241', flag: '🇬🇦', region: 'AF', example: '06 12 34 56' },
  { name: 'Congo DRC', code: 'CD', dialCode: '+243', flag: '🇨🇩', region: 'AF', example: '81 234 5678' },
  { name: 'Congo', code: 'CG', dialCode: '+242', flag: '🇨🇬', region: 'AF', example: '06 123 4567' },
  { name: 'Mali', code: 'ML', dialCode: '+223', flag: '🇲🇱', region: 'AF', example: '65 12 34 56' },
  { name: 'Guinea', code: 'GN', dialCode: '+224', flag: '🇬🇳', region: 'AF', example: '620 12 34 56' },
  { name: 'Rwanda', code: 'RW', dialCode: '+250', flag: '🇷🇼', region: 'AF', example: '788 123 456' },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // France
