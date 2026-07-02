import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Stack, Button, Card, CardContent } from '@mui/material';
import AppleIcon from '@mui/icons-material/Apple';
import AndroidIcon from '@mui/icons-material/Android';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';

/**
 * AppDownloadPage - Web fallback landing page for deep links
 * Shows when user clicks invite link but doesn't have the app installed
 * Provides download links and option to continue in browser
 */
const AppDownloadPage: React.FC = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();

  // Attempt to open the app with a timeout fallback
  useEffect(() => {
    if (!inviteCode) return;

    const attemptDeepLink = () => {
      // Try to open the app with custom scheme
      const deepLinkUrl = `stellarsave://join/${inviteCode}`;
      const timeout = setTimeout(() => {
        // If still on this page after 2 seconds, app probably isn't installed
        console.log('App not detected, showing download options');
      }, 2000);

      // Attempt to open deep link
      window.location.href = deepLinkUrl;

      return () => clearTimeout(timeout);
    };

    // Small delay to let the page render first
    const timer = setTimeout(attemptDeepLink, 500);
    return () => clearTimeout(timer);
  }, [inviteCode]);

  const handleContinueInBrowser = () => {
    if (inviteCode) {
      navigate(`/join/${inviteCode}`);
    } else {
      navigate('/');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        sx={{
          maxWidth: 500,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* App Icon */}
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
            }}
          >
            <PhoneAndroidIcon sx={{ fontSize: 48, color: 'white' }} />
          </Box>

          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Open in Stellar Save
          </Typography>

          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            You've been invited to join a savings group! Get the best experience with our mobile app.
          </Typography>

          {/* App Store Buttons */}
          <Stack spacing={2} sx={{ mb: 3 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<AppleIcon />}
              sx={{
                backgroundColor: '#000',
                color: '#fff',
                '&:hover': { backgroundColor: '#333' },
                textTransform: 'none',
                py: 1.5,
              }}
              href="https://apps.apple.com/app/stellar-save/id123456789"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download on the App Store
            </Button>

            <Button
              variant="contained"
              size="large"
              startIcon={<AndroidIcon />}
              sx={{
                backgroundColor: '#3DDC84',
                color: '#000',
                '&:hover': { backgroundColor: '#2db86b' },
                textTransform: 'none',
                py: 1.5,
              }}
              href="https://play.google.com/store/apps/details?id=com.stellarsave.app"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get it on Google Play
            </Button>
          </Stack>

          {/* Divider */}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', my: 2 }}
          >
            OR
          </Typography>

          {/* Web Fallback */}
          <Button
            variant="text"
            onClick={handleContinueInBrowser}
            sx={{ textTransform: 'none' }}
          >
            Continue in browser
          </Button>
        </CardContent>
      </Card>

      {/* Footer */}
      <Typography
        variant="caption"
        color="rgba(255,255,255,0.7)"
        sx={{ mt: 4, textAlign: 'center' }}
      >
        Stellar Save - Transparent, on-chain savings powered by Stellar
      </Typography>
    </Box>
  );
};

export default AppDownloadPage;
