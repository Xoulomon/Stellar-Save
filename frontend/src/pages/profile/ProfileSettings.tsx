import {
  Stack,
  Typography,
  Alert,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
} from '@mui/material';
import { useState } from 'react';

import { Button } from '../../components/Button';

export interface ProfileSettingsProps {
  displayName: string;
  onSave: (name: string, theme: string, language: string) => void;
}

export function ProfileSettings({ displayName, onSave }: ProfileSettingsProps) {
  const [name, setName] = useState(displayName);
  const [theme, setTheme] = useState('dark');
  const [language, setLanguage] = useState('en');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave(name, theme, language);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h3">Profile Settings</Typography>
      {saved && <Alert severity="success">Settings saved successfully.</Alert>}

      <TextField
        label="Display Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        fullWidth
        size="small"
        inputProps={{ maxLength: 50 }}
        helperText={`${name.length}/50 characters`}
      />

      <FormControl fullWidth size="small">
        <InputLabel>Theme</InputLabel>
        <Select value={theme} label="Theme" onChange={(e) => setTheme(e.target.value)}>
          <MenuItem value="light">Light</MenuItem>
          <MenuItem value="dark">Dark</MenuItem>
          <MenuItem value="auto">System Default</MenuItem>
        </Select>
      </FormControl>

      <FormControl fullWidth size="small">
        <InputLabel>Language</InputLabel>
        <Select value={language} label="Language" onChange={(e) => setLanguage(e.target.value)}>
          <MenuItem value="en">English</MenuItem>
          <MenuItem value="es">Español</MenuItem>
          <MenuItem value="fr">Français</MenuItem>
          <MenuItem value="pt">Português</MenuItem>
        </Select>
      </FormControl>

      <Box>
        <Button variant="primary" onClick={handleSave}>
          Save Settings
        </Button>
      </Box>
    </Stack>
  );
}
