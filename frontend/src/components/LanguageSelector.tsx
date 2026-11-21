import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';

import { useI18n } from '../hooks/useI18n';

import type { LanguageCode } from '../i18n';

export function LanguageSelector() {
  const { t, currentLanguage, changeLanguage, supportedLanguages } = useI18n();
  const languageLabel = t('settings.language');

  return (
    <FormControl size="small" sx={{ minWidth: 160 }}>
      <InputLabel id="language-select-label">{languageLabel}</InputLabel>
      <Select
        labelId="language-select-label"
        id="language-select"
        value={currentLanguage}
        label={languageLabel}
        onChange={(e) => changeLanguage(e.target.value as LanguageCode)}
        inputProps={{ 'aria-label': 'Select language' }}
      >
        {supportedLanguages.map(({ code, label }) => (
          <MenuItem key={code} value={code}>
            {label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
