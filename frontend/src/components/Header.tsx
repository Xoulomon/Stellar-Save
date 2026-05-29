/**
 * Header / Navbar — Issue #771
 *
 * Mobile-responsive navigation using MUI Drawer:
 * - useMediaQuery detects mobile breakpoint
 * - Hamburger IconButton opens a slide-in Drawer on mobile
 * - All nav links accessible via keyboard and screen reader
 * - Dark mode toggle button (sun/moon icon) — Issue #772
 * - Wallet connect button
 */
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
  Divider,
  Tooltip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import StarIcon from '@mui/icons-material/Star';
import { ROUTES } from '../routing/constants';
import { WalletButton } from './WalletButton';
import { useThemeMode } from '../context/ThemeContext';

const DRAWER_WIDTH = 260;

const NAV_LINKS = [
  { label: 'Groups', href: ROUTES.GROUPS },
  { label: 'Dashboard', href: ROUTES.DASHBOARD },
  { label: 'Profile', href: ROUTES.PROFILE },
];

export default function Header() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { mode, toggleTheme } = useThemeMode();
  const location = useLocation();

  const handleDrawerToggle = () => setDrawerOpen((v) => !v);
  const handleDrawerClose = () => setDrawerOpen(false);

  const isActive = (href: string) => location.pathname === href;

  // ── Drawer content ──────────────────────────────────────────────────────────
  const drawerContent = (
    <Box
      sx={{ width: DRAWER_WIDTH, height: '100%', display: 'flex', flexDirection: 'column' }}
      role="navigation"
      aria-label="Mobile navigation"
    >
      {/* Drawer header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StarIcon sx={{ color: 'primary.main', fontSize: 22 }} />
          <Typography variant="h6" fontWeight={700} color="primary">
            Stellar-Save
          </Typography>
        </Box>
        <IconButton
          onClick={handleDrawerClose}
          aria-label="Close navigation menu"
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider />

      {/* Nav links */}
      <List sx={{ flex: 1, pt: 1 }}>
        {NAV_LINKS.map(({ label, href }) => (
          <ListItem key={href} disablePadding>
            <ListItemButton
              component={Link}
              to={href}
              onClick={handleDrawerClose}
              selected={isActive(href)}
              aria-current={isActive(href) ? 'page' : undefined}
              sx={{
                mx: 1,
                borderRadius: 2,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { bgcolor: 'primary.dark' },
                },
              }}
            >
              <ListItemText
                primary={label}
                primaryTypographyProps={{ fontWeight: isActive(href) ? 700 : 400 }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider />

      {/* Theme toggle in drawer */}
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary">
          {mode === 'dark' ? 'Dark mode' : 'Light mode'}
        </Typography>
        <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          <IconButton onClick={toggleTheme} size="small" aria-label="Toggle theme">
            {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          color: 'text.primary',
          zIndex: theme.zIndex.appBar,
        }}
      >
        <Toolbar sx={{ gap: 2, minHeight: { xs: 56, sm: 64 } }}>
          {/* Logo */}
          <Box
            component={Link}
            to={ROUTES.HOME}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              textDecoration: 'none',
              color: 'inherit',
              flexShrink: 0,
            }}
            aria-label="Stellar-Save home"
          >
            <StarIcon sx={{ color: 'primary.main', fontSize: 26 }} />
            <Typography variant="h6" fontWeight={700} color="primary" sx={{ display: { xs: 'none', sm: 'block' } }}>
              Stellar-Save
            </Typography>
          </Box>

          {/* Desktop nav links */}
          {!isMobile && (
            <Box
              component="nav"
              aria-label="Main navigation"
              sx={{ display: 'flex', gap: 0.5, ml: 2 }}
            >
              {NAV_LINKS.map(({ label, href }) => (
                <Box
                  key={href}
                  component={Link}
                  to={href}
                  aria-current={isActive(href) ? 'page' : undefined}
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 2,
                    textDecoration: 'none',
                    fontWeight: isActive(href) ? 700 : 400,
                    fontSize: '0.9rem',
                    color: isActive(href) ? 'primary.main' : 'text.secondary',
                    bgcolor: isActive(href) ? 'action.selected' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </Box>
              ))}
            </Box>
          )}

          {/* Spacer */}
          <Box sx={{ flex: 1 }} />

          {/* Theme toggle — desktop */}
          {!isMobile && (
            <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <IconButton
                onClick={toggleTheme}
                aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                size="small"
                sx={{ color: 'text.secondary' }}
              >
                {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>
          )}

          {/* Wallet button */}
          <WalletButton />

          {/* Hamburger — mobile only */}
          {isMobile && (
            <IconButton
              onClick={handleDrawerToggle}
              aria-label={drawerOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={drawerOpen}
              aria-controls="mobile-nav-drawer"
              edge="end"
              sx={{ color: 'text.primary' }}
            >
              <MenuIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        id="mobile-nav-drawer"
        anchor="right"
        open={drawerOpen && isMobile}
        onClose={handleDrawerClose}
        ModalProps={{ keepMounted: true }} // better mobile performance
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
          },
        }}
      >
        {drawerContent}
      </Drawer>
    </>
  );
}
