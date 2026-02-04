import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Instagram, Youtube, Facebook, Linkedin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import bikerzLogo from '@/assets/bikerz-logo.png';

// Custom X (Twitter) icon
const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// Custom TikTok icon
const TikTokIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
  </svg>
);

// Custom Snapchat icon
const SnapchatIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301a.602.602 0 01.271-.056c.263 0 .49.105.598.299.158.283.011.6-.103.779a2.67 2.67 0 01-.239.299c-.36.391-.815.605-1.298.756a.628.628 0 00-.375.39c-.046.135-.018.285.09.435.334.465.742.915 1.139 1.261.262.232.538.435.879.593.179.085.289.215.299.39.015.24-.15.45-.405.555-.481.195-1.275.255-1.92.255h-.135c-.45 0-.9-.015-1.35-.015-.225 0-.45.015-.675.06-.225.045-.406.12-.586.225-.18.09-.345.18-.51.285-.165.09-.33.18-.495.255-.315.135-.615.195-.9.195-.285 0-.585-.06-.9-.195a7.47 7.47 0 01-.495-.255c-.165-.105-.33-.195-.51-.285-.18-.105-.36-.18-.586-.225a4.696 4.696 0 00-.675-.06c-.45 0-.9.015-1.35.015h-.135c-.645 0-1.439-.06-1.92-.255-.255-.105-.42-.315-.405-.555.015-.18.12-.305.299-.39.341-.158.617-.361.879-.593.397-.346.805-.796 1.139-1.261.108-.15.136-.3.09-.435a.628.628 0 00-.375-.39c-.483-.151-.938-.365-1.298-.756a2.67 2.67 0 01-.239-.299c-.114-.179-.261-.496-.103-.779.108-.194.335-.299.598-.299a.602.602 0 01.271.056c.374.181.733.285 1.033.301.198 0 .326-.045.401-.09-.008-.165-.018-.33-.03-.51l-.003-.06c-.104-1.628-.23-3.654.299-4.847C7.86 1.069 11.216.793 12.206.793z" />
  </svg>
);

interface SocialLink {
  platform: string;
  url: string;
  is_visible: boolean;
}

interface FooterContent {
  email?: string;
  phone?: string;
  tagline_en?: string;
  tagline_ar?: string;
  social_links?: SocialLink[];
}

const Footer: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  // Fetch footer content from database
  const { data: footerContent } = useQuery({
    queryKey: ['footer-content'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'footer')
        .eq('category', 'landing')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return (data?.value as FooterContent) || {};
    },
    staleTime: 5 * 60 * 1000,
  });

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'x': return XIcon;
      case 'instagram': return Instagram;
      case 'tiktok': return TikTokIcon;
      case 'snapchat': return SnapchatIcon;
      case 'youtube': return Youtube;
      case 'facebook': return Facebook;
      case 'linkedin': return Linkedin;
      default: return XIcon;
    }
  };

  const getPlatformLabel = (platform: string) => {
    switch (platform) {
      case 'x': return 'X';
      case 'instagram': return 'Instagram';
      case 'tiktok': return 'TikTok';
      case 'snapchat': return 'Snapchat';
      case 'youtube': return 'YouTube';
      case 'facebook': return 'Facebook';
      case 'linkedin': return 'LinkedIn';
      default: return platform;
    }
  };

  // Default social links if not configured
  const defaultSocialLinks: SocialLink[] = [
    { platform: 'x', url: '#', is_visible: true },
    { platform: 'instagram', url: '#', is_visible: true },
    { platform: 'tiktok', url: '#', is_visible: true },
    { platform: 'snapchat', url: '#', is_visible: true },
    { platform: 'youtube', url: '#', is_visible: true },
  ];

  const socialLinks = (footerContent?.social_links && footerContent.social_links.length > 0) 
    ? footerContent.social_links.filter(link => link.is_visible !== false)
    : defaultSocialLinks;

  const tagline = isRTL 
    ? (footerContent?.tagline_ar || t('footer.tagline'))
    : (footerContent?.tagline_en || t('footer.tagline'));

  const email = footerContent?.email || 'info@bikerz.sa';
  const phone = footerContent?.phone || '+966 50 111 1111';

  return (
    <footer className="bg-card/50 border-t border-border/30 safe-area-bottom">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 lg:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1 space-y-4">
            <Link to="/" className="inline-block">
              <img
                src={bikerzLogo}
                alt="BIKERZ"
                className="h-12 sm:h-14 w-auto object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
              />
            </Link>
            <p className="text-muted-foreground text-sm max-w-xs">
              {tagline}
            </p>
            <div className="flex gap-2 sm:gap-3">
              {socialLinks.map((social, index) => {
                const IconComponent = getPlatformIcon(social.platform);
                return (
                  <a
                    key={`${social.platform}-${index}`}
                    href={social.url || '#'}
                    target={social.url && social.url !== '#' ? '_blank' : undefined}
                    rel={social.url && social.url !== '#' ? 'noopener noreferrer' : undefined}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-muted/30 border border-border/30 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all duration-300 touch-target"
                    aria-label={getPlatformLabel(social.platform)}
                  >
                    <IconComponent className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-foreground mb-3 sm:mb-4">{t('footer.links')}</h4>
            <ul className="space-y-2 sm:space-y-3">
              <li>
                <Link to="/courses" className="text-muted-foreground hover:text-foreground transition-colors py-1 inline-block">
                  {t('nav.courses')}
                </Link>
              </li>
              <li>
                <Link to="/mentors" className="text-muted-foreground hover:text-foreground transition-colors py-1 inline-block">
                  {t('nav.mentors')}
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors py-1 inline-block">
                  {t('nav.about')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold text-foreground mb-3 sm:mb-4">{t('footer.legal')}</h4>
            <ul className="space-y-2 sm:space-y-3">
              <li>
                <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors py-1 inline-block">
                  {t('footer.privacy')}
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors py-1 inline-block">
                  {t('footer.terms')}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors py-1 inline-block">
                  {t('footer.contact')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-foreground mb-3 sm:mb-4">{t('footer.contact')}</h4>
            <div className="space-y-2 sm:space-y-3 text-muted-foreground text-sm">
              <p>{email}</p>
              <p dir="ltr" className="text-start">{phone}</p>
              <p>{t('footer.location')}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 sm:mt-10 lg:mt-12 pt-6 sm:pt-8 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-start">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} BIKERZ. {t('footer.rights')}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
