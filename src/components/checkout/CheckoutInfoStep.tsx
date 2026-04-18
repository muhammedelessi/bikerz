import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  User, Mail, MapPin, Pencil, Info,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import SearchableDropdown from '@/components/checkout/SearchableDropdown';
import type { DropdownOption } from '@/components/checkout/SearchableDropdown';
import type { ValidationErrors } from '@/types/payment';
import type { User as AuthUser } from '@supabase/supabase-js';
import { joinFullName, splitFullName } from '@/lib/nameUtils';
import { CountryCityPicker, PhoneField, NameFields } from '@/components/ui/fields';

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
  const { t } = useTranslation();
  const { firstName, lastName } = useMemo(() => splitFullName(fullName), [fullName]);
  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (!phone.trim()) missing.push(t('fields.phone.label'));
    const effectiveCountry = isOtherCountry ? countryManual.trim() : (cityOptions.length > 0 ? 'set' : '');
    if (!effectiveCountry && !isOtherCountry && !cityOptions.length) missing.push(t('fields.country.label'));
    const effectiveCity = (isOtherCity || isOtherCountry) ? cityManual.trim() : city.trim();
    if (!effectiveCity) missing.push(t('fields.city.label'));
    return missing;
  }, [phone, city, cityManual, isOtherCity, isOtherCountry, countryManual, cityOptions.length, t]);

  return (
    <motion.div
      key="info"
      initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
      className="space-y-4"
    >
      {/* Missing fields warning */}
      {user && missingFields.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 dark:text-amber-300">
            <p className="font-semibold mb-0.5">
              {isRTL ? 'يرجى إكمال البيانات التالية للمتابعة:' : 'Please complete the following to continue:'}
            </p>
            <p>{missingFields.join(isRTL ? '، ' : ', ')}</p>
          </div>
        </div>
      )}

      {/* Personal Information Section */}
      <div className="flex items-center gap-2 mb-1">
        <User className="w-4 h-4 text-primary" />
        <h4 className="font-semibold text-foreground">
          {isRTL ? 'المعلومات الشخصية' : 'Personal Information'}
        </h4>
      </div>

      {/* Name */}
      <FormField label={`${t('fields.firstName.label')} ${t('fields.lastName.label')}`} error={errors.fullName} required>
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
          <NameFields
            firstName={firstName}
            lastName={lastName}
            onFirstNameChange={(val) => {
              setFullName(joinFullName(val, lastName));
              setErrors(prev => ({ ...prev, firstName: undefined, fullName: undefined }));
            }}
            onLastNameChange={(val) => {
              setFullName(joinFullName(firstName, val));
              setErrors(prev => ({ ...prev, lastName: undefined, fullName: undefined }));
            }}
            firstNameError={errors.firstName}
            lastNameError={errors.lastName}
            required
          />
        )}
      </FormField>

      {/* Email */}
      <FormField
        label={t('fields.email.label')}
        error={errors.email}
        required
      >
        {user ? (
          <div className="flex items-center rounded-md border border-input bg-muted/30 px-3 py-2 h-10">
            <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0 me-2" />
            <span className="text-sm text-foreground truncate" dir="ltr">{email}</span>
          </div>
        ) : (
          <div className="relative">
            <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: undefined })); }}
              placeholder={t('fields.email.placeholder')}
              className={`ps-11 ${errors.email ? 'border-destructive' : ''}`}
            />
          </div>
        )}
      </FormField>

      {/* Phone */}
      <PhoneField
        phonePrefix={phonePrefix}
        phoneNumber={phone}
        onPrefixChange={setPhonePrefix}
        onNumberChange={(val) => {
          setPhone(val);
          setErrors(prev => ({ ...prev, phone: undefined }));
        }}
        error={errors.phone}
        required
      />

      {/* Billing Address Section */}
      <div className="rounded-lg border border-border p-3 space-y-3 mt-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <h4 className="font-semibold text-foreground text-sm">
            {isRTL ? 'عنوان الفاتورة' : 'Billing Address'}
          </h4>
        </div>

        <CountryCityPicker
          country={isOtherCountry ? '__other__' : selectedCountryCode}
          city={isOtherCity ? '__other__' : city}
          onCountryChange={handleCountryChange}
          onCityChange={handleCityChange}
          customCountry={countryManual}
          onCustomCountryChange={(v) => { setCountryManual(v); setCountry(v); setErrors(prev => ({ ...prev, country: undefined })); }}
          customCity={cityManual}
          onCustomCityChange={(v) => { setCityManual(v); setErrors(prev => ({ ...prev, city: undefined })); }}
          countryError={errors.country}
          cityError={errors.city}
          required
        />
      </div>
    </motion.div>
  );
});

CheckoutInfoStep.displayName = 'CheckoutInfoStep';

export default CheckoutInfoStep;
