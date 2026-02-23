import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AuthPageContent {
  // Login page
  login_title_en?: string;
  login_title_ar?: string;
  login_subtitle_en?: string;
  login_subtitle_ar?: string;
  login_button_en?: string;
  login_button_ar?: string;
  login_image?: string;
  login_forgot_en?: string;
  login_forgot_ar?: string;
  login_no_account_en?: string;
  login_no_account_ar?: string;
  login_signup_link_en?: string;
  login_signup_link_ar?: string;
  // Signup page
  signup_title_en?: string;
  signup_title_ar?: string;
  signup_subtitle_en?: string;
  signup_subtitle_ar?: string;
  signup_button_en?: string;
  signup_button_ar?: string;
  signup_image?: string;
  signup_has_account_en?: string;
  signup_has_account_ar?: string;
  signup_login_link_en?: string;
  signup_login_link_ar?: string;
  signup_name_label_en?: string;
  signup_name_label_ar?: string;
  signup_email_label_en?: string;
  signup_email_label_ar?: string;
  signup_password_label_en?: string;
  signup_password_label_ar?: string;
  signup_confirm_label_en?: string;
  signup_confirm_label_ar?: string;
}

export const useAuthPageContent = () => {
  return useQuery({
    queryKey: ['auth-page-content'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', ['login_page', 'signup_page']);

      if (error) throw error;

      const content: { login: Record<string, string>; signup: Record<string, string> } = {
        login: {},
        signup: {},
      };

      data?.forEach((item) => {
        if (item.key === 'login_page') content.login = item.value as Record<string, string>;
        if (item.key === 'signup_page') content.signup = item.value as Record<string, string>;
      });

      return content;
    },
    staleTime: 5 * 60 * 1000,
  });
};
