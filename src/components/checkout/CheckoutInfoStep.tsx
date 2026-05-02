import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  User, Mail, MapPin, Pencil, Info, ShieldCheck,
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

/**
 * Visual section card — wraps a group of related fields with an icon header.
 * Adds clear visual hierarchy on both mobile and desktop without taking
 * excessive vertical space.
 */
const SectionCard: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ icon: Icon, title, subtitle, children }) => (
  <section className="rounded-2xl border border-border bg-card/40 p-3.5 sm:p-4 space-y-3.5">
    <header className="flex items-center gap-2.5">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <h4 className="font-semibold text-foreground text-sm leading-tight">{title}</h4>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{subtitle}</p>
        )}
      </div>
    </header>
    {children}
  </section>
);

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
      className="space-y-3 sm:space-y-4"
    >
      {/* Welcome strip — sets the tone, builds trust */}
      <div className="flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2.5">
        <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
        <p className="text-xs text-foreground/80 leading-tight">
          {isRTL
            ? 'بياناتك محمية ولا تُستخدم إلا لإصدار الفاتورة وتأكيد التسجيل.'
            : 'Your details are protected and only used for invoicing and enrollment confirmation.'}
        </p>
      </div>

      {/* Missing fields warning */}
      {user && missingFields.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
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
      <SectionCard
        icon={User}
        title={isRTL ? 'المعلومات الشخصية' : 'Personal Information'}
        subtitle={isRTL ? 'الاسم الذي سيظهر على الفاتورة' : 'Name shown on your invoice'}
      >
        {/* Name */}
        <FormField label={`${t('fields.firstName.label')} ${t('fields.lastName.label')}`} error={errors.fullName} required>
          {hasNamePrefilled && !isEditingName ? (
            <div className="flex items-center justify-between rounded-lg border border-input bg-muted/30 px-3 py-2 h-11">
              <div className="flex items-center gap-2 min-w-0">
                <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium text-foreground truncate">{fullName}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors min-h-[32px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={isRTL ? 'تعديل الاسم' : 'Edit name'}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isRTL ? 'تعديل' : 'Edit'}</span>
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
            <div className="flex items-center rounded-lg border border-input bg-muted/30 px-3 py-2 h-11">
              <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0 me-2" />
              <span className="text-sm text-foreground truncate" dir="ltr">{email}</span>
              <span className="ms-auto inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-3 h-3" />
                <span className="hidden sm:inline">{isRTL ? 'موثّق' : 'Verified'}</span>
              </span>
            </div>
          ) : (
            <div className="relative">
              <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: undefined })); }}
                placeholder={t('fields.email.placeholder')}
                className={`ps-11 h-11 ${errors.email ? 'border-destructive' : ''}`}
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
      </SectionCard>

      {/* Billing Address Section */}
      <SectionCard
        icon={MapPin}
        title={isRTL ? 'عنوان الفاتورة' : 'Billing Address'}
        subtitle={isRTL ? 'مطلوب من بوابة الدفع' : 'Required by the payment gateway'}
      >
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
      </SectionCard>
    </motion.div>
  );
});

CheckoutInfoStep.displayName = 'CheckoutInfoStep';

export default CheckoutInfoStep;
