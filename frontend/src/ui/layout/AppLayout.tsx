import { useMemo, useState, type ReactNode } from "react";
import {
  AppBar,
  Box,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { WalletStatusIndicator } from "../../components/WalletStatusIndicator";

export interface LayoutNavItem {
  key: string;
  label: string;
  onClick?: () => void;
}

export interface AppLayoutProps {
  title: string;
  subtitle?: string;
  navItems?: LayoutNavItem[];
  sidebar?: ReactNode;
  children: ReactNode;
  footerText?: string;
}

const drawerWidth = 280;

export function AppLayout({
  title,
  subtitle,
  navItems = [],
  sidebar,
  children,
  footerText = "Stellar Save",
}: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const hasSidebar = Boolean(sidebar);

  const mobileMenuItems = useMemo(
    () =>
      navItems.map((item) => (
        <ListItemButton
          key={item.key}
          onClick={() => {
            item.onClick?.();
            setIsMobileMenuOpen(false);
          }}
        >
          <ListItemText primary={item.label} />
        </ListItemButton>
      )),
    [navItems],
  );

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Skip-to-content link — visible only when focused, for keyboard/AT users */}
      <a
        href="#main-content"
        style={{
          position: "absolute",
          top: -9999,
          left: 8,
          zIndex: 9999,
          padding: "8px 16px",
          background: "#1976d2",
          color: "#fff",
          fontWeight: 600,
          borderRadius: 4,
          textDecoration: "none",
        }}
        onFocus={(e) => { e.currentTarget.style.top = "8px"; }}
        onBlur={(e) => { e.currentTarget.style.top = "-9999px"; }}
      >
        Skip to main content
      </a>
      <AppBar position="sticky" color="transparent" elevation={0}>
        <Toolbar
          sx={{
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(8px)",
            gap: 1,
          }}
        >
          <IconButton
            edge="start"
            sx={{ display: { md: "none" } }}
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <span aria-hidden="true">Menu</span>
          </IconButton>

          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h2">{title}</Typography>
            {subtitle ? (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            ) : null}
          </Box>

          <Stack direction="row" spacing={1} sx={{ display: { xs: "none", md: "flex" } }}>
            {navItems.map((item) => (
              <ListItemButton
                key={item.key}
                onClick={item.onClick}
                sx={{
                  borderRadius: 1.5,
                  px: 1.5,
                  minHeight: "auto",
                  width: "auto",
                }}
              >
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </Stack>

          <WalletStatusIndicator />
        </Toolbar>
      </AppBar>

      <Container
        component="main"
        id="main-content"
        maxWidth="lg"
        sx={{
          width: "100%",
          flexGrow: 1,
          py: { xs: 2, md: 3 },
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: hasSidebar
              ? { xs: "1fr", md: "280px 1fr" }
              : "1fr",
            gap: 2,
            alignItems: "start",
          }}
        >
          {hasSidebar ? (
            <Box sx={{ display: { xs: "none", md: "block" } }}>{sidebar}</Box>
          ) : null}
          <Box>{children}</Box>
        </Box>
      </Container>

      <Box
        component="footer"
        sx={{
          borderTop: "1px solid",
          borderColor: "divider",
          py: 1.5,
          px: 2,
          bgcolor: "background.paper",
        }}
      >
        <Container maxWidth="lg">
          <Typography variant="body2" color="text.secondary">
            {footerText}
          </Typography>
        </Container>
      </Box>

      <Drawer
        anchor="left"
        open={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: "block", md: "none" } }}
      >
        <Box sx={{ width: drawerWidth }} role="presentation">
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="h2">{title}</Typography>
          </Box>
          <Divider />
          <List>{mobileMenuItems}</List>
          {hasSidebar ? (
            <>
              <Divider />
              <Box sx={{ p: 2 }}>{sidebar}</Box>
            </>
          ) : null}
        </Box>
      </Drawer>
    </Box>
  );
}

