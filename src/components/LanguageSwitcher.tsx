import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/enhanced-button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Globe } from 'lucide-react';

const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const getFlagEmoji = (lang: string) => {
    switch (lang) {
      case 'tr':
        return '🇹🇷';
      case 'en':
        return '🇬🇧';
      default:
        return '🌐';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          {getFlagEmoji(i18n.language)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem 
          onClick={() => changeLanguage('tr')}
          className="cursor-pointer gap-2"
        >
          <span>🇹🇷</span>
          <span>{t('language.turkish')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => changeLanguage('en')}
          className="cursor-pointer gap-2"
        >
          <span>🇬🇧</span>
          <span>{t('language.english')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;