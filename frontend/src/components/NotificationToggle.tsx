/**
 * NotificationToggle.tsx
 *
 * A simple on/off toggle for contribution reminder notifications.
 * Drop this into the Settings page or a user profile panel.
 *
 * Usage:
 *   <NotificationToggle />
 */

import { Switch, FormControlLabel, Typography, Box, Tooltip } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import { usePushNotifications } from '../hooks/usePushNotifications';

export function NotificationToggle() {
  const { permission, enabled, toggleEnabled } = usePushNotifications();

  const isUnsupported = permission === 'unsupported';
  const isDenied = permission === 'denied';
  const isDisabled = isUnsupported || isDenied;

  const tooltipText = isUnsupported
    ? 'Push notifications are not supported in this browser.'
    : isDenied
      ? 'Notification permission was denied. Enable it in your browser settings.'
      : enabled
        ? 'Turn off contribution reminders'
        : 'Turn on contribution reminders';

  return (
    <Box display="flex" alignItems="center" gap={1}>
      {enabled && !isDisabled ? (
        <NotificationsIcon fontSize="small" color="primary" />
      ) : (
        <NotificationsOffIcon fontSize="small" color="disabled" />
      )}

      <Tooltip title={tooltipText} placement="top">
        <span>
          <FormControlLabel
            control={
              <Switch
                checked={enabled && !isDisabled}
                onChange={toggleEnabled}
                disabled={isDisabled}
                size="small"
                color="primary"
                inputProps={{ 'aria-label': 'Toggle contribution reminders' }}
              />
            }
            label={
              <Typography variant="body2" color={isDisabled ? 'text.disabled' : 'text.primary'}>
                Contribution reminders
              </Typography>
            }
          />
        </span>
      </Tooltip>
    </Box>
  );
}
