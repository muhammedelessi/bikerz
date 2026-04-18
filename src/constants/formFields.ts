export const FORM_FIELDS = {
  fullName: {
    label: { ar: "الاسم الكامل", en: "Full Name" },
    placeholder: { ar: "أدخل اسمك الكامل هنا", en: "Enter your full name" },
    hint: { ar: "", en: "" },
  },
  email: {
    label: { ar: "البريد الإلكتروني", en: "Email Address" },
    placeholder: { ar: "أدخل بريدك الإلكتروني هنا", en: "Enter your email address" },
    hint: { ar: "لن نشارك بريدك مع أحد", en: "We'll never share your email" },
  },
  password: {
    label: { ar: "كلمة المرور", en: "Password" },
    placeholder: { ar: "أدخل كلمة المرور", en: "Enter your password" },
    hint: { ar: "6 أحرف على الأقل", en: "At least 6 characters" },
  },
  phone: {
    label: { ar: "رقم الهاتف", en: "Phone Number" },
    placeholder: { ar: "أدخل رقم هاتفك", en: "Enter your phone number" },
    hint: { ar: "مثال: 5XXXXXXXX", en: "e.g. 5XXXXXXXX" },
  },
  country: {
    label: { ar: "الدولة", en: "Country" },
    placeholder: { ar: "اختر دولتك", en: "Select your country" },
    hint: { ar: "", en: "" },
  },
  city: {
    label: { ar: "المدينة", en: "City" },
    placeholder: { ar: "اختر مدينتك", en: "Select your city" },
    hint: { ar: "", en: "" },
  },
  notes: {
    label: { ar: "ملاحظات", en: "Notes" },
    placeholder: { ar: "أضف أي ملاحظات إضافية هنا", en: "Add any additional notes here" },
    hint: { ar: "اختياري", en: "Optional" },
  },
  nickname: {
    label: { ar: "اللقب", en: "Nickname" },
    placeholder: { ar: "اسمك المستعار", en: "Your nickname" },
    hint: { ar: "يظهر للمجتمع", en: "Visible to community" },
  },
  dateOfBirth: {
    label: { ar: "تاريخ الميلاد", en: "Date of Birth" },
    placeholder: { ar: "اختر تاريخ ميلادك", en: "Select your date of birth" },
    hint: { ar: "", en: "" },
  },
  gender: {
    label: { ar: "الجنس", en: "Gender" },
    placeholder: { ar: "اختر", en: "Select" },
    hint: { ar: "", en: "" },
  },
};

export const field = (key: keyof typeof FORM_FIELDS, isRTL: boolean) => ({
  label: FORM_FIELDS[key].label[isRTL ? "ar" : "en"],
  placeholder: FORM_FIELDS[key].placeholder[isRTL ? "ar" : "en"],
  hint: FORM_FIELDS[key].hint[isRTL ? "ar" : "en"] || undefined,
});
