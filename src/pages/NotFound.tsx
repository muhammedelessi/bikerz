import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center p-8">
        <h1 className="mb-4 text-6xl font-bold text-primary">{t('notFound.title')}</h1>
        <p className="mb-8 text-xl text-muted-foreground">{t('notFound.subtitle')}</p>
        <Link to="/">
          <Button variant="cta" className="gap-2">
            <Home className="w-4 h-4" />
            {t('notFound.returnHome')}
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
