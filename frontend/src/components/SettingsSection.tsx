import React, { useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import './SettingsSection.css';

interface SettingsSectionProps {
  className?: string;
}

export function SettingsSection({ className = '' }: SettingsSectionProps) {
  const [settings, setSettings] = useState({
    displayName: 'Stellar Saver',
    emailNotifications: true,
    pushNotifications: false,
    theme: 'dark',
    language: 'en',
  });

  const handleSave = () => {
    // In a real app, this would save to backend
    console.log('Saving settings:', settings);
  };

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className={`settings-section ${className}`}>
      <h3 className="settings-title">Settings</h3>

      <div className="settings-grid">
        <div className="setting-group">
          <label className="setting-label">Display Name</label>
          <Input
            type="text"
            value={settings.displayName}
            onChange={(e) => updateSetting('displayName', e.target.value)}
            placeholder="Enter your display name"
          />
        </div>

        <div className="setting-group">
          <label className="setting-label">Theme</label>
          <select
            className="settings-select"
            value={settings.theme}
            onChange={(e) => updateSetting('theme', e.target.value)}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto</option>
          </select>
        </div>

        <div className="setting-group">
          <label className="setting-label">Language</label>
          <select
            className="settings-select"
            value={settings.language}
            onChange={(e) => updateSetting('language', e.target.value)}
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
          </select>
        </div>

        <div className="setting-group">
          <label className="setting-label">Notifications</label>
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) => updateSetting('emailNotifications', e.target.checked)}
              />
              Email notifications
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.pushNotifications}
                onChange={(e) => updateSetting('pushNotifications', e.target.checked)}
              />
              Push notifications
            </label>
          </div>
        </div>
      </div>

      <div className="settings-actions">
        <Button onClick={handleSave} variant="primary">
          Save Settings
        </Button>
      </div>
    </div>
  );
}