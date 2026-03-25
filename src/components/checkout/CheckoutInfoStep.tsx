import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  User, Mail, MapPin, Pencil, AlertCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SearchableDropdown from '@/components/checkout/SearchableDropdown';
import type { DropdownOption } from '@/components/checkout/SearchableDropdown';
import type { ValidationErrors } from '@/types/payment';
import type { User as AuthUser } from '@supabase/supabase-js';

interface CheckoutInfoStepProps {
  isRTL: boolean;
  user: AuthUser | null;
  // Name
  fullName: string;
  setFullName: (v: string) => void;
  hasNamePrefilled: boolean;
  isEditingName: boolean;
  setIsEditingName: (v: boolean) => void;
  // Email
  email: string;
  setEmail: (v: string) => void;
  // Phone
  phone: string;
  setPhone: (v: string) => void;
  phonePrefix: string;
  setPhonePrefix: (v: string) => void;
  phonePrefixOptions: DropdownOption[];
  // Billing
  countryOptions: DropdownOption[];
  cityOptions: DropdownOption[];
  selectedCountryCode: string;
  isOtherCountry: boolean;
  isOtherCity: boolean;
  countryManual: string;
  setCountryManual: (v: string) => void;
  setCountry: (v: string) => void;
  cityManual: string;
  setCityManual: (v: string) => void;
  handleCountryChange: (code: string) => void;
  handleCityChange: (val: string) => void;
  city: string;
  // Errors
  errors: ValidationErrors;
  setErrors: (fn: (prev: ValidationErrors) => ValidationErrors) => void;
}

const FieldError: React.FC<{ message?: string }> = memo(({ message }) => {
  if (!message) return null;
  return (
    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
      <AlertCircle className="w-3 h-3" />
      {message}
    </p>
  );
});
FieldError.displayName = 'FieldError';

const CheckoutInfoStep: React.FC<CheckoutInfoStepProps> = memo(({
  isRTL, user,
  fullName, setFullName, hasNamePrefilled, isEditingName, setIsEditingName,
  email, setEmail,
  phone, setPhone, phonePrefix, setPhonePrefix, phonePrefixOptions,
  countryOptions, cityOptions, selectedCountryCode,
  isOtherCountry, isOtherCity, countryManual, setCountryManual, setCountry,
  cityManual, setCityManual, handleCountryChange, handleCityChange, city,
  errors, setErrors,
}) => {
  return (
    <motion.div
      key="info"
      initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
      className="space-y-4"
    >
      {/* Personal Information Section */}
      <div className="flex items-center gap-2 mb-1">
        <User className="w-4 h-4 text-primary" />
        <h4 className="font-semibold text-foreground">
          {isRTL ? 'المعلومات الشخصية' : 'Personal Information'}
        </h4>
      </div>

      {/* Name */}
      <div className="space-y-1">
        {hasNamePrefilled && !isEditingName ? (
          <div className="flex items-center justify-between rounded-md border border-input bg-muted/30 px-3 py-2 h-10">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium text-foreground">{fullName}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsEditingName(true)}
              className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <User className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setErrors(prev => ({ ...prev, fullName: undefined })); }}
              placeholder={isRTL ? 'الاسم الكامل' : 'Full name'}
              className={`ps-9 ${errors.fullName ? 'border-destructive' : ''}`}
              autoFocus={isEditingName}
            />
          </div>
        )}
        <FieldError message={errors.fullName} />
      </div>

      {/* Email */}
      <div className="space-y-1">
        {user ? (
          <div className="flex items-center rounded-md border border-input bg-muted/30 px-3 py-2 h-10">
            <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0 me-2" />
            <span className="text-sm text-foreground truncate" dir="ltr">{email}</span>
          </div>
        ) : (
          <>
            <div className="relative">
              <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: undefined })); }}
                placeholder={isRTL ? 'البريد الإلكتروني' : 'Email address'}
                className={`ps-9 ${errors.email ? 'border-destructive' : ''}`}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isRTL ? 'سيتم إنشاء حساب لك تلقائياً باستخدام هذا البريد' : 'An account will be created automatically with this email'}
            </p>
          </>
        )}
        <FieldError message={errors.email} />
      </div>

      {/* Phone */}
      <div className="space-y-1">
        <div className="flex gap-2" dir="ltr">
          <div className="flex-shrink-0 w-[110px]">
            <SearchableDropdown
              options={phonePrefixOptions}
              value={phonePrefix}
              onChange={(val) => setPhonePrefix(val)}
              placeholder="+---"
              searchPlaceholder={isRTL ? 'ابحث...' : 'Search...'}
              dir="ltr"
            />
          </div>
          <Input
            value={phone}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '');
              setPhone(val);
              setErrors(prev => ({ ...prev, phone: undefined }));
            }}
            placeholder="5XXXXXXXX"
            className={`flex-1 ${errors.phone ? 'border-destructive' : ''}`}
            dir="ltr"
          />
        </div>
        <FieldError message={errors.phone} />
      </div>

      {/* Billing Address Section */}
      <div className="rounded-lg border border-border p-3 space-y-3 mt-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <h4 className="font-semibold text-foreground text-sm">
            {isRTL ? 'عنوان الفاتورة' : 'Billing Address'}
          </h4>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Country */}
          <div className="space-y-1.5">
            <Label className="text-xs">{isRTL ? 'الدولة' : 'Country'} <span className="text-destructive">*</span></Label>
            <SearchableDropdown
              options={countryOptions}
              value={isOtherCountry ? '__other__' : selectedCountryCode}
              onChange={handleCountryChange}
              placeholder={isRTL ? 'اختر الدولة' : 'Select country'}
              searchPlaceholder={isRTL ? 'ابحث...' : 'Search...'}
              hasError={!!errors.country}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
            {isOtherCountry && (
              <Input
                value={countryManual}
                onChange={(e) => { setCountryManual(e.target.value); setCountry(e.target.value); setErrors(prev => ({ ...prev, country: undefined })); }}
                placeholder={isRTL ? 'اسم الدولة' : 'Country name'}
                className={`text-sm ${errors.country ? 'border-destructive' : ''}`}
                autoFocus
              />
            )}
            <FieldError message={errors.country} />
          </div>

          {/* City */}
          <div className="space-y-1.5">
            <Label className="text-xs">{isRTL ? 'المدينة' : 'City'} <span className="text-destructive">*</span></Label>
            {isOtherCountry ? (
              <Input
                value={cityManual}
                onChange={(e) => { setCityManual(e.target.value); setErrors(prev => ({ ...prev, city: undefined })); }}
                placeholder={isRTL ? 'اسم المدينة' : 'City name'}
                className={`text-sm ${errors.city ? 'border-destructive' : ''}`}
              />
            ) : (
              <>
                <SearchableDropdown
                  options={cityOptions}
                  value={isOtherCity ? '__other__' : city}
                  onChange={handleCityChange}
                  placeholder={isRTL ? 'اختر المدينة' : 'Select city'}
                  searchPlaceholder={isRTL ? 'ابحث...' : 'Search...'}
                  hasError={!!errors.city}
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
                {isOtherCity && (
                  <Input
                    value={cityManual}
                    onChange={(e) => { setCityManual(e.target.value); setErrors(prev => ({ ...prev, city: undefined })); }}
                    placeholder={isRTL ? 'اسم المدينة' : 'City name'}
                    className={`text-sm ${errors.city ? 'border-destructive' : ''}`}
                    autoFocus
                  />
                )}
              </>
            )}
            <FieldError message={errors.city} />
          </div>
        </div>
      </div>
    </motion.div>
  );
});

CheckoutInfoStep.displayName = 'CheckoutInfoStep';

export default CheckoutInfoStep;
