import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { FormField } from '@/components/ui/form-field';
import {
  DateOfBirthPicker,
  CountryCityPicker,
  PhoneField,
  NameFields,
  GenderPicker,
  NationalityPicker,
} from '@/components/ui/fields';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, X, Upload, Images, Languages, ChevronDown } from 'lucide-react';
import BilingualInput from '@/components/admin/content/BilingualInput';
import { BikeGarage } from '@/components/ui/profile/BikeGarage';
import { cn } from '@/lib/utils';
import { joinFullName } from '@/lib/trainer-name-utils';
import { composeTrainerPhone, parseTrainerPhone } from '@/lib/trainer-phone-utils';
import { COUNTRIES, getCityDisplayLabel } from '@/data/countryCityData';
import {
  LANGUAGE_LEVEL_OPTIONS,
  TRAINER_LANGUAGE_OPTIONS,
  languageOptionLabel,
} from '@/lib/trainer-form-constants';
import {
  MAX_ALBUM_PHOTOS,
  MAX_ALBUM_PHOTO_BYTES,
  validateAlbumPhotoFile,
  validateTrainerFormSubmit,
} from '@/lib/trainer-form-validation';
import type { TrainerFormMode, TrainerFormSubmission, TrainerFormValues } from '@/types/trainerForm';

export type { TrainerFormMode, TrainerFormValues, TrainerFormSubmission } from '@/types/trainerForm';

function countryDisplayName(code: string, isRTL: boolean): string {
  const c = COUNTRIES.find((x) => x.code === code.trim());
  if (!c) return code.trim();
  return isRTL ? c.ar : c.en;
}

function formatGenderSummary(raw: string, isRTL: boolean): string {
  const g = (raw ?? '').trim();
  if (!g) return '';
  if (!isRTL) return g;
  if (g === 'Male') return 'ذكر';
  if (g === 'Female') return 'أنثى';
  if (g === 'Other') return 'آخر';
  return g;
}

function defaultValues(mode: TrainerFormMode, initial?: Partial<TrainerFormValues>): TrainerFormValues {
  const phone = initial?.phone ?? '';
  const parsed = parseTrainerPhone(phone);
  const base: TrainerFormValues = {
    photo_url: initial?.photo_url ?? null,
    photo_album: initial?.photo_album ? [...initial.photo_album] : [],
    first_name_ar: initial?.first_name_ar ?? '',
    last_name_ar: initial?.last_name_ar ?? '',
    first_name_en: initial?.first_name_en ?? '',
    last_name_en: initial?.last_name_en ?? '',
    phone,
    phone_country_code: initial?.phone_country_code ?? parsed.prefixKey,
    email: initial?.email ?? '',
    date_of_birth: initial?.date_of_birth ?? null,
    bio_ar: initial?.bio_ar ?? '',
    bio_en: initial?.bio_en ?? '',
    country: initial?.country ?? '',
    city: initial?.city ?? '',
    gender: initial?.gender ?? '',
    nationality: initial?.nationality ?? '',
    bike_entries: initial?.bike_entries ? [...initial.bike_entries] : [],
    years_of_experience: initial?.years_of_experience ?? 0,
    languages: initial?.languages ? [...initial.languages] : [],
    services: initial?.services ? [...initial.services] : [],
    status: initial?.status ?? 'active',
    assigned_training_ids: initial?.assigned_training_ids ? [...initial.assigned_training_ids] : [],
    license_type: initial?.license_type ?? '',
    profit_ratio: initial?.profit_ratio ?? 0,
  };
  if (mode === 'apply') {
    return { ...base, photo_album: [] };
  }
  return base;
}

function modeHidesField(mode: TrainerFormMode, field: keyof TrainerFormValues): boolean {
  if (mode === 'apply' && field === 'photo_album') return true;
  if (mode === 'apply' && field === 'status') return true;
  if (mode === 'apply' && field === 'assigned_training_ids') return true;
  if (mode === 'self-edit' && field === 'status') return true;
  if (mode === 'self-edit' && field === 'assigned_training_ids') return true;
  return false;
}

function fieldVisible(
  field: keyof TrainerFormValues,
  mode: TrainerFormMode,
  hidden?: (keyof TrainerFormValues)[],
): boolean {
  if (hidden?.includes(field)) return false;
  if ((field === 'gender' || field === 'nationality') && (mode === 'admin-create' || mode === 'admin-edit')) {
    return false;
  }
  return !modeHidesField(mode, field);
}

function fieldReadonly(
  field: keyof TrainerFormValues,
  readonly?: (keyof TrainerFormValues)[],
): boolean {
  return !!readonly?.includes(field);
}

export interface TrainerFormProps {
  mode: TrainerFormMode;
  /** Change to reset internal state from `initialValues`. */
  formResetKey?: string | number;
  initialValues?: Partial<TrainerFormValues>;
  readonlyFields?: (keyof TrainerFormValues)[];
  hiddenFields?: (keyof TrainerFormValues)[];
  requireSingleBio?: boolean;
  onSubmit: (submission: TrainerFormSubmission) => Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
  trainingsSlot?: React.ReactNode;
  garageStorageUserId?: string | null;
  /** When true, omit the built-in Save row (e.g. admin page uses header/footer actions). */
  hideSubmitButton?: boolean;
  onValuesChange?: (values: TrainerFormValues) => void;
}

export interface TrainerFormHandle {
  submit: () => Promise<void>;
}

function TrainerFormInner(
  {
    mode,
    formResetKey,
    initialValues,
    readonlyFields,
    hiddenFields,
    requireSingleBio = false,
    onSubmit,
    isSubmitting = false,
    submitLabel,
    trainingsSlot,
    garageStorageUserId = null,
    hideSubmitButton = false,
    onValuesChange,
  }: TrainerFormProps,
  ref: React.Ref<TrainerFormHandle>,
) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const locationFieldDir = isRTL ? 'rtl' : 'ltr';

  const [values, setValues] = useState<TrainerFormValues>(() => defaultValues(mode, initialValues));
  const [singleBio, setSingleBio] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initialValues?.photo_url ?? null);
  const [pendingAlbumImages, setPendingAlbumImages] = useState<{ file: File; preview: string }[]>([]);
  const [serviceInput, setServiceInput] = useState('');
  const [isOtherCity, setIsOtherCity] = useState(false);
  const [languageAddCode, setLanguageAddCode] = useState('');
  const [languageAddLevel, setLanguageAddLevel] = useState<string>(LANGUAGE_LEVEL_OPTIONS[1]!.value);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [namesOpen, setNamesOpen] = useState(mode !== 'apply');

  const fileRef = useRef<HTMLInputElement>(null);
  const albumPhotosInputRef = useRef<HTMLInputElement>(null);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const revokePendingList = useCallback((list: { preview: string }[]) => {
    list.forEach((p) => URL.revokeObjectURL(p.preview));
  }, []);

  const initialRef = useRef(initialValues);
  initialRef.current = initialValues;

  useEffect(() => {
    setValues(defaultValues(mode, initialRef.current));
    setPhotoFile(null);
    setPhotoPreview(initialRef.current?.photo_url ?? null);
    setPendingAlbumImages((prev) => {
      revokePendingList(prev);
      return [];
    });
    setSingleBio('');
    setServiceInput('');
    setLanguageAddCode('');
    setLanguageAddLevel(LANGUAGE_LEVEL_OPTIONS[1]!.value);
    setErrors({});
    setNamesOpen(mode !== 'apply');
  }, [formResetKey, mode, requireSingleBio, revokePendingList]);

  const parsedPhone = useMemo(() => parseTrainerPhone(values.phone), [values.phone]);

  useEffect(() => {
    onValuesChange?.(values);
  }, [values, onValuesChange]);

  const setPhonePrefix = useCallback((prefixKey: string) => {
    setValues((v) => ({
      ...v,
      phone_country_code: prefixKey,
      phone: composeTrainerPhone(prefixKey, parseTrainerPhone(v.phone).local),
    }));
  }, []);

  const setPhoneLocal = useCallback((local: string) => {
    setValues((v) => ({
      ...v,
      phone: composeTrainerPhone(v.phone_country_code || parsedPhone.prefixKey, local),
    }));
  }, [parsedPhone.prefixKey]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const addAlbumPhotoFiles = (files: FileList | null) => {
    if (!files?.length) return;
    setPendingAlbumImages((prev) => {
      const next = [...prev];
      for (const file of Array.from(files)) {
        const chk = validateAlbumPhotoFile(file, isRTL);
        if (!chk.ok) {
          const msg =
            'errors' in chk && chk.errors.general
              ? chk.errors.general
              : isRTL
                ? 'ملف غير صالح'
                : 'Invalid file';
          setErrors((e) => ({ ...e, general: msg }));
          continue;
        }
        if (valuesRef.current.photo_album.length + next.length >= MAX_ALBUM_PHOTOS) {
          setErrors((e) => ({
            ...e,
            general: isRTL ? `الحد الأقصى ${MAX_ALBUM_PHOTOS} صور` : `Maximum ${MAX_ALBUM_PHOTOS} album photos`,
          }));
          break;
        }
        next.push({ file, preview: URL.createObjectURL(file) });
      }
      return next;
    });
    if (albumPhotosInputRef.current) albumPhotosInputRef.current.value = '';
  };

  const removeAlbumPhotoUrl = (url: string) => {
    setValues((v) => ({ ...v, photo_album: v.photo_album.filter((u) => u !== url) }));
  };

  const removePendingAlbumAt = (index: number) => {
    setPendingAlbumImages((prev) => {
      const row = prev[index];
      if (row) URL.revokeObjectURL(row.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const addService = () => {
    if (serviceInput.trim()) {
      setValues((v) => ({ ...v, services: [...v.services, serviceInput.trim()] }));
      setServiceInput('');
    }
  };

  const addTrainerLanguage = useCallback(() => {
    if (!languageAddCode) {
      setErrors((e) => ({ ...e, general: isRTL ? 'اختر لغة' : 'Choose a language' }));
      return;
    }
    if (values.languages.some((x) => x.code === languageAddCode)) {
      setErrors((e) => ({ ...e, general: isRTL ? 'هذه اللغة مضافة بالفعل' : 'That language is already added' }));
      return;
    }
    setValues((v) => ({
      ...v,
      languages: [...v.languages, { code: languageAddCode, level: languageAddLevel }],
    }));
    setLanguageAddCode('');
  }, [languageAddCode, languageAddLevel, values.languages, isRTL]);

  const submit = useCallback(async () => {
    setErrors({});
    const vCheck = validateTrainerFormSubmit({
      mode,
      values,
      requireSingleBio,
      singleBioDraft: singleBio,
      hiddenFields,
      readonlyFields,
      isRTL,
    });
    if (!vCheck.ok) {
      setErrors(vCheck.errors as Record<string, string>);
      return;
    }

    let out: TrainerFormValues = { ...values };
    if (requireSingleBio && !out.bio_ar.trim() && !out.bio_en.trim()) {
      out = { ...out, bio_ar: singleBio.trim() };
    }
    if (mode === 'apply') {
      out = {
        ...out,
        first_name_en: out.first_name_ar,
        last_name_en: out.last_name_ar,
        bio_en: '',
      };
    }

    const submission: TrainerFormSubmission = {
      values: out,
      profilePhotoFile: photoFile,
      pendingAlbumFiles: pendingAlbumImages,
    };
    await onSubmit(submission);
  }, [
    mode,
    values,
    requireSingleBio,
    singleBio,
    photoFile,
    pendingAlbumImages,
    hiddenFields,
    readonlyFields,
    isRTL,
    onSubmit,
  ]);

  useImperativeHandle(ref, () => ({ submit }), [submit]);

  const vis = (field: keyof TrainerFormValues) => fieldVisible(field, mode, hiddenFields);
  const ro = (field: keyof TrainerFormValues) => fieldReadonly(field, readonlyFields);

  const label = (key: string) => t(`trainerForm.${key}`);

  const applyPersonalSummaryRows = useMemo(() => {
    if (mode !== 'apply' || !readonlyFields?.length) return [];
    const rf = new Set(readonlyFields);
    const isRo = (f: keyof TrainerFormValues) => rf.has(f);
    const rows: { key: string; label: string; value: string }[] = [];

    const nameAr = joinFullName(values.first_name_ar, values.last_name_ar).trim();
    if (isRo('first_name_ar') && nameAr) {
      rows.push({ key: 'name', label: t('trainerForm.profileSummaryName'), value: nameAr });
    }

    const email = (values.email || '').trim();
    if (isRo('email') && email) {
      rows.push({ key: 'email', label: t('trainerForm.profileSummaryEmail'), value: email });
    }

    const phone = (values.phone || '').trim();
    if (isRo('phone') && phone) {
      rows.push({ key: 'phone', label: t('trainerForm.profileSummaryPhone'), value: phone });
    }

    if (isRo('country') && isRo('city')) {
      const cityRaw = (values.city || '').trim();
      const countryCode = (values.country || '').trim();
      const cityShown = countryCode ? getCityDisplayLabel(countryCode, cityRaw, isRTL) : cityRaw;
      const countryName = countryCode ? countryDisplayName(countryCode, isRTL) : '';
      const addr = isRTL
        ? [cityShown, countryName].filter(Boolean).join(' — ')
        : [countryName, cityShown].filter(Boolean).join(' — ');
      if (addr) {
        rows.push({ key: 'address', label: t('trainerForm.profileSummaryAddress'), value: addr });
      }
    }

    if (isRo('date_of_birth') && values.date_of_birth) {
      const d = values.date_of_birth;
      let formatted = d;
      try {
        formatted = new Date(`${d}T12:00:00`).toLocaleDateString(isRTL ? 'ar' : 'en-US', { dateStyle: 'long' });
      } catch {
        /* keep raw */
      }
      rows.push({ key: 'dob', label: t('trainerForm.profileSummaryDateOfBirth'), value: formatted });
    }

    if (isRo('gender') && (values.gender || '').trim()) {
      rows.push({
        key: 'gender',
        label: t('trainerForm.profileSummaryGender'),
        value: formatGenderSummary(values.gender, isRTL),
      });
    }

    if (isRo('nationality') && (values.nationality || '').trim()) {
      const nat = COUNTRIES.find((c) => c.code === values.nationality.trim());
      const natLabel = nat ? (isRTL ? nat.ar : nat.en) : values.nationality.trim();
      rows.push({ key: 'nationality', label: t('trainerForm.profileSummaryNationality'), value: natLabel });
    }

    if (isRo('years_of_experience')) {
      rows.push({
        key: 'yoe',
        label: t('trainerForm.profileSummaryYearsExperience'),
        value: String(values.years_of_experience ?? ''),
      });
    }

    return rows;
  }, [mode, readonlyFields, values, isRTL, t]);

  const showApplyNameCollapsible = !(mode === 'apply' && ro('first_name_ar'));
  const showApplyPhoneField = !(mode === 'apply' && ro('phone'));
  const showApplyEmailField = !(mode === 'apply' && ro('email') && (values.email || '').trim());
  const showApplyDobField = !(mode === 'apply' && ro('date_of_birth'));
  const showApplyCountryCity = !(mode === 'apply' && ro('country') && ro('city'));
  const showApplyYearsField = !(mode === 'apply' && ro('years_of_experience'));
  const showApplyGenderField = !(mode === 'apply' && ro('gender'));
  const showApplyNationalityField = !(mode === 'apply' && ro('nationality'));

  return (
    <div className="space-y-6">
      {errors.general ? (
        <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
          {errors.general}
        </p>
      ) : null}

      <Card>
        <CardContent className="p-6 space-y-5">
          {applyPersonalSummaryRows.length > 0 ? (
            <div
              className="rounded-lg border border-border bg-muted/25 p-4 space-y-2.5"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              <p className="text-sm font-semibold text-foreground">{label('profileSummarySection')}</p>
              <div className="space-y-2">
                {applyPersonalSummaryRows.map((row) => (
                  <div key={row.key} className="text-sm leading-relaxed">
                    <span className="text-muted-foreground">{row.label}:</span>{' '}
                    <span className="font-medium text-foreground break-words [unicode-bidi:plaintext]" dir="auto">
                      {row.key === 'email' ? <span dir="ltr">{row.value}</span> : row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {label('sectionBasic')}
          </h3>

          {vis('photo_url') ? (
            <div
              onClick={() => !ro('photo_url') && fileRef.current?.click()}
              className={cn(
                'flex items-center gap-4 p-4 border-2 border-dashed border-border rounded-lg transition-colors',
                ro('photo_url') ? 'opacity-80' : 'cursor-pointer hover:border-primary/50',
              )}
            >
              <Avatar className="h-16 w-16">
                <AvatarImage src={photoPreview || values.photo_url || ''} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary">
                  <Upload className="w-6 h-6" />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{label('trainerPhoto')}</p>
                <p className="text-xs text-muted-foreground">
                  {mode === 'apply' && (photoPreview || values.photo_url) && !photoFile
                    ? label('trainerPhotoFromProfile')
                    : label('trainerPhotoHint')}
                </p>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} disabled={ro('photo_url')} />
            </div>
          ) : null}

          {vis('photo_album') ? (
            <FormField label={label('photoAlbum')} hint={label('photoAlbumHint')}>
              <div className="flex flex-wrap gap-2 items-start">
                {values.photo_album.map((url) => (
                  <div key={url} className="relative w-20 h-20 rounded-md border border-border overflow-hidden shrink-0 group/thumb">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    {!ro('photo_album') ? (
                      <button
                        type="button"
                        className="absolute top-0.5 end-0.5 w-5 h-5 rounded-full bg-background/90 border text-xs flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                        onClick={() => removeAlbumPhotoUrl(url)}
                        aria-label={label('remove')}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    ) : null}
                  </div>
                ))}
                {pendingAlbumImages.map((p, i) => (
                  <div key={p.preview} className="relative w-20 h-20 rounded-md border border-border overflow-hidden shrink-0 group/thumb">
                    <img src={p.preview} alt="" className="w-full h-full object-cover" />
                    {!ro('photo_album') ? (
                      <button
                        type="button"
                        className="absolute top-0.5 end-0.5 w-5 h-5 rounded-full bg-background/90 border text-xs flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                        onClick={() => removePendingAlbumAt(i)}
                        aria-label={label('remove')}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    ) : null}
                  </div>
                ))}
                {!ro('photo_album') ? (
                  <button
                    type="button"
                    onClick={() => albumPhotosInputRef.current?.click()}
                    disabled={values.photo_album.length + pendingAlbumImages.length >= MAX_ALBUM_PHOTOS}
                    className="w-20 h-20 rounded-md border border-dashed border-muted-foreground/40 flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
                  >
                    <Images className="w-5 h-5" />
                    <span className="text-[10px]">{label('add')}</span>
                  </button>
                ) : null}
                <input
                  ref={albumPhotosInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => addAlbumPhotoFiles(e.target.files)}
                />
              </div>
            </FormField>
          ) : null}

          {mode === 'apply' && showApplyNameCollapsible ? (
            <Collapsible open={namesOpen} onOpenChange={setNamesOpen}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="gap-1 px-0 text-muted-foreground hover:text-foreground">
                  <ChevronDown className={cn('h-4 w-4 transition-transform', namesOpen && 'rotate-180')} />
                  {label('namesOptionalToggle')}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <NameFields
                  firstName={values.first_name_ar}
                  lastName={values.last_name_ar}
                  onFirstNameChange={(val) => setValues((v) => ({ ...v, first_name_ar: val }))}
                  onLastNameChange={(val) => setValues((v) => ({ ...v, last_name_ar: val }))}
                  firstNameLabel={label('firstNameAr')}
                  lastNameLabel={label('lastNameAr')}
                  disabled={ro('first_name_ar') || ro('last_name_ar')}
                />
              </CollapsibleContent>
            </Collapsible>
          ) : mode !== 'apply' ? (
            <div className="grid grid-cols-1 gap-4">
              {vis('first_name_ar') ? (
                <NameFields
                  firstName={values.first_name_ar}
                  lastName={values.last_name_ar}
                  onFirstNameChange={(val) => setValues((v) => ({ ...v, first_name_ar: val }))}
                  onLastNameChange={(val) => setValues((v) => ({ ...v, last_name_ar: val }))}
                  firstNameLabel={label('firstNameAr')}
                  lastNameLabel={label('lastNameAr')}
                  disabled={ro('first_name_ar') || ro('last_name_ar')}
                />
              ) : null}
              {vis('first_name_en') ? (
                <NameFields
                  firstName={values.first_name_en}
                  lastName={values.last_name_en}
                  onFirstNameChange={(val) => setValues((v) => ({ ...v, first_name_en: val }))}
                  onLastNameChange={(val) => setValues((v) => ({ ...v, last_name_en: val }))}
                  firstNameLabel={label('firstNameEn')}
                  lastNameLabel={label('lastNameEn')}
                  inputDir="ltr"
                  inputClassName={isRTL ? 'text-right placeholder:text-right' : 'text-left placeholder:text-left'}
                  disabled={ro('first_name_en') || ro('last_name_en')}
                />
              ) : null}
            </div>
          ) : null}

          {vis('phone') && showApplyPhoneField ? (
            <div className="md:col-span-2">
              <PhoneField
                phonePrefix={values.phone_country_code || parsedPhone.prefixKey}
                phoneNumber={parsedPhone.local}
                onPrefixChange={ro('phone') ? () => {} : setPhonePrefix}
                onNumberChange={ro('phone') ? () => {} : setPhoneLocal}
                disabled={ro('phone')}
                error={errors.phone}
              />
            </div>
          ) : null}

          {vis('email') && showApplyEmailField ? (
            <div className="md:col-span-2">
              <FormField label={label('email')} error={errors.email}>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={values.email}
                  onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
                  dir="ltr"
                  readOnly={ro('email')}
                  className={cn(
                    '[direction:ltr] [unicode-bidi:plaintext]',
                    isRTL ? 'text-right placeholder:text-right' : 'text-left placeholder:text-left',
                  )}
                />
              </FormField>
            </div>
          ) : null}

          {vis('date_of_birth') && showApplyDobField ? (
            <div className="md:col-span-2">
              <DateOfBirthPicker
                value={values.date_of_birth}
                onChange={(date) => setValues((v) => ({ ...v, date_of_birth: date }))}
                disabled={ro('date_of_birth')}
              />
            </div>
          ) : null}

          {vis('gender') && (mode !== 'apply' || showApplyGenderField) ? (
            <div className="md:col-span-2">
              <GenderPicker
                value={values.gender}
                onChange={(v) => setValues((f) => ({ ...f, gender: v }))}
                disabled={ro('gender')}
                required={mode === 'apply' && !ro('gender')}
                error={errors.gender}
              />
            </div>
          ) : null}

          {vis('nationality') && (mode !== 'apply' || showApplyNationalityField) ? (
            <div className="md:col-span-2">
              <NationalityPicker
                value={values.nationality}
                onChange={(v) => setValues((f) => ({ ...f, nationality: v }))}
                disabled={ro('nationality')}
                required={mode === 'apply' && !ro('nationality')}
                error={errors.nationality ?? undefined}
              />
            </div>
          ) : null}

          {requireSingleBio ? (
            <FormField label={label('singleBio')} hint={label('singleBioHint')} error={errors.singleBio}>
              <textarea
                className={cn(
                  'flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                  isRTL ? 'text-right' : 'text-left',
                )}
                value={singleBio}
                onChange={(e) => setSingleBio(e.target.value)}
                readOnly={ro('bio_ar') && ro('bio_en')}
                dir={isRTL ? 'rtl' : 'ltr'}
              />
            </FormField>
          ) : null}

          {(vis('bio_ar') || vis('bio_en')) && !requireSingleBio ? (
            <BilingualInput
              labelEn={label('bioEn')}
              labelAr={label('bioAr')}
              valueEn={values.bio_en}
              valueAr={values.bio_ar}
              onChangeEn={(v) => setValues((s) => ({ ...s, bio_en: v }))}
              onChangeAr={(v) => setValues((s) => ({ ...s, bio_ar: v }))}
              isTextarea
              rows={3}
              readOnlyEn={ro('bio_en')}
              readOnlyAr={ro('bio_ar')}
            />
          ) : null}

          {vis('years_of_experience') && showApplyYearsField ? (
            <FormField
              label={label('yearsExperience')}
              hint={label('yearsExperienceHint')}
              error={errors.years_of_experience}
            >
              <Input
                type="number"
                min={0}
                value={values.years_of_experience}
                readOnly={ro('years_of_experience')}
                onChange={(e) => setValues((f) => ({ ...f, years_of_experience: parseInt(e.target.value, 10) || 0 }))}
              />
            </FormField>
          ) : null}

          {vis('country') && vis('city') && showApplyCountryCity ? (
            <CountryCityPicker
              country={values.country}
              city={values.city}
              onCountryChange={(v) => {
                if (ro('country')) return;
                setValues((f) => ({ ...f, country: v, city: '' }));
                setIsOtherCity(false);
              }}
              onCityChange={(v) => {
                if (ro('city')) return;
                setValues((f) => ({ ...f, city: v }));
                setIsOtherCity(v === '__other__');
              }}
              customCity={isOtherCity ? values.city : ''}
              onCustomCityChange={(v) => {
                if (ro('city')) return;
                setValues((f) => ({ ...f, city: v }));
              }}
              disabled={ro('country') || ro('city')}
            />
          ) : null}

          {vis('bike_entries') ? (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {label('sectionGarage')}
                </h3>
              </div>
              <div
                className={cn(
                  'rounded-xl border border-border/70 bg-muted/10 p-4',
                  ro('bike_entries') && 'pointer-events-none opacity-80',
                )}
              >
                <BikeGarage
                  entries={values.bike_entries}
                  onChange={(updated) => {
                    if (ro('bike_entries')) return;
                    setValues((v) => ({ ...v, bike_entries: updated }));
                  }}
                  userId={garageStorageUserId}
                  storageFolder="bikes"
                />
                {mode === 'admin-create' && !garageStorageUserId && values.bike_entries.length === 0 ? (
                  <p className="mt-2 text-center text-xs text-muted-foreground">{label('bikePhotosAfterSave')}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {vis('status') && (mode === 'admin-create' || mode === 'admin-edit') ? (
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <Label className="text-sm font-medium">{label('status')}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{label('statusHint')}</p>
              </div>
              <Switch
                checked={values.status === 'active'}
                disabled={ro('status')}
                onCheckedChange={(v) => setValues((f) => ({ ...f, status: v ? 'active' : 'inactive' }))}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {vis('languages') ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              <Languages className="h-4 w-4 shrink-0" aria-hidden />
              {label('sectionLanguages')}
            </h3>
            <p className="text-xs text-muted-foreground">{label('languagesIntro')}</p>

            <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="min-w-0 flex-[1.2] sm:min-w-[12rem]">
                <FormField label={label('language')}>
                  <Select
                    dir={locationFieldDir}
                    value={languageAddCode || '__none__'}
                    onValueChange={(v) => setLanguageAddCode(v === '__none__' ? '' : v)}
                    disabled={ro('languages')}
                  >
                    <SelectTrigger dir={locationFieldDir} className="h-9 w-full">
                      <SelectValue placeholder={label('languagePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent dir={locationFieldDir}>
                      <SelectItem value="__none__">{label('languageNone')}</SelectItem>
                      {TRAINER_LANGUAGE_OPTIONS.filter((opt) => !values.languages.some((e) => e.code === opt.code)).map((opt) => (
                        <SelectItem key={opt.code} value={opt.code}>
                          {isRTL ? opt.label_ar : opt.label_en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              <div className="min-w-0 flex-1 sm:min-w-[12rem]">
                <FormField label={label('languageLevel')}>
                  <Select dir={locationFieldDir} value={languageAddLevel} onValueChange={setLanguageAddLevel} disabled={ro('languages')}>
                    <SelectTrigger dir={locationFieldDir} className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir={locationFieldDir}>
                      {LANGUAGE_LEVEL_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {isRTL ? opt.label_ar : opt.label_en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="h-9 gap-1 shrink-0 sm:min-w-[7.5rem]"
                onClick={addTrainerLanguage}
                disabled={!languageAddCode || ro('languages')}
              >
                <Plus className="h-4 w-4" />
                {label('add')}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-muted-foreground">{label('quickAdd')}</span>
              {TRAINER_LANGUAGE_OPTIONS.filter(
                (opt) => ['ar', 'en', 'ur'].includes(opt.code) && !values.languages.some((e) => e.code === opt.code),
              ).map((opt) => (
                <Button
                  key={opt.code}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  disabled={ro('languages')}
                  onClick={() =>
                    setValues((f) => ({
                      ...f,
                      languages: [...f.languages, { code: opt.code, level: languageAddLevel }],
                    }))
                  }
                >
                  {isRTL ? opt.label_ar : opt.label_en}
                </Button>
              ))}
            </div>

            <FormField label={label('languagesAdded')}>
              {values.languages.length === 0 ? (
                <p className="text-xs text-muted-foreground">{label('languagesEmpty')}</p>
              ) : (
                <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
                  {values.languages.map((row, i) => {
                    const levelVal = LANGUAGE_LEVEL_OPTIONS.some((x) => x.value === row.level) ? row.level : LANGUAGE_LEVEL_OPTIONS[4]!.value;
                    return (
                      <li key={`${row.code}-${i}`} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-sm font-medium">{languageOptionLabel(row.code, isRTL)}</span>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <Select
                            value={levelVal}
                            disabled={ro('languages')}
                            onValueChange={(v) =>
                              setValues((f) => ({
                                ...f,
                                languages: f.languages.map((e, idx) => (idx === i ? { ...e, level: v } : e)),
                              }))
                            }
                          >
                            <SelectTrigger className="h-9 w-full min-w-[10rem] sm:w-[14rem]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {LANGUAGE_LEVEL_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {isRTL ? opt.label_ar : opt.label_en}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                            disabled={ro('languages')}
                            onClick={() => setValues((f) => ({ ...f, languages: f.languages.filter((_, idx) => idx !== i) }))}
                            aria-label={label('removeLanguage')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </FormField>
          </CardContent>
        </Card>
      ) : null}

      {vis('services') ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{label('sectionServices')}</h3>
            <FormField label={label('addService')}>
              <div className="flex gap-2">
                <Input
                  value={serviceInput}
                  onChange={(e) => setServiceInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addService())}
                  placeholder={label('servicePlaceholder')}
                  className="flex-1"
                  readOnly={ro('services')}
                />
                <Button type="button" variant="outline" size="icon" onClick={addService} disabled={ro('services')}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </FormField>
            <FormField label={label('currentServices')}>
              <div className="flex flex-wrap gap-2">
                {values.services.map((s, i) => (
                  <Badge key={`${s}-${i}`} variant="secondary" className="gap-1 px-3 py-1.5">
                    {s}
                    {!ro('services') ? (
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-destructive"
                        onClick={() => setValues((f) => ({ ...f, services: f.services.filter((_, idx) => idx !== i) }))}
                      />
                    ) : null}
                  </Badge>
                ))}
                {values.services.length === 0 ? <p className="text-xs text-muted-foreground">{label('servicesEmpty')}</p> : null}
              </div>
            </FormField>
          </CardContent>
        </Card>
      ) : null}

      {trainingsSlot}

      {!hideSubmitButton ? (
        <div className="flex justify-end gap-3 pb-2">
          <Button type="button" onClick={() => void submit()} disabled={isSubmitting}>
            {isSubmitting ? '...' : submitLabel ?? label('save')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const TrainerForm = forwardRef<TrainerFormHandle, TrainerFormProps>(TrainerFormInner);
TrainerForm.displayName = 'TrainerForm';

export default TrainerForm;
