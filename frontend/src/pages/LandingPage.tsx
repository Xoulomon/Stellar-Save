import {
  Box,
  Container,
  Grid,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { AppButton } from "../ui/components/AppButton";
import { AppCard } from "../ui/components/AppCard";

/**
 * LandingPage - Public landing page for unauthenticated users
 * Features: Hero section, Features, How It Works, CTA buttons
 */
export default function LandingPage() {
  const theme = useTheme();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: `linear-gradient(180deg, ${theme.palette.background.default} 0%, ${theme.palette.background.paper} 100%)`,
      }}
    >
      {/* Navigation Bar */}
      <Box
        component="header"
        sx={{
          py: 2,
          px: 3,
          borderBottom: `1px solid ${theme.palette.divider}`,
          background: theme.palette.background.paper,
        }}
      >
        <Container maxWidth="lg">
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography
              variant="h2"
              sx={{
                color: "primary.main",
                fontWeight: 700,
              }}
            >
              Stellar Save
            </Typography>
            <Stack direction="row" spacing={2}>
              <AppButton variant="text" size="small">
                Features
              </AppButton>
              <AppButton variant="text" size="small">
                How It Works
              </AppButton>
              <AppButton variant="outlined" size="small">
                Connect Wallet
              </AppButton>
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* Hero Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Grid container spacing={4} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={3}>
              <Typography
                sx={{
                  color: "primary.main",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Transparent Savings on Stellar
              </Typography>
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: "2.5rem", md: "3.5rem" },
                  color: "text.primary",
                  lineHeight: 1.1,
                }}
              >
                Save Together, Win Together
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: "text.secondary",
                  fontSize: { xs: "1rem", md: "1.125rem" },
                  maxWidth: 480,
                }}
              >
                Join community savings circles where everyone contributes equally
                and takes turns receiving the pool. Built on Stellar for
                transparent, secure, and instant transactions.
              </Typography>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{ pt: 2 }}
              >
                <AppButton variant="contained" size="large">
                  Get Started
                </AppButton>
                <AppButton variant="outlined" size="large">
                  View Groups
                </AppButton>
              </Stack>
              <Stack direction="row" spacing={3} sx={{ pt: 3 }}>
                <Box>
                  <Typography variant="h2" sx={{ color: "primary.main" }}>
                    2.5M+
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Saved
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h2" sx={{ color: "primary.main" }}>
                    10K+
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Groups
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h2" sx={{ color: "primary.main" }}>
                    50K+
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Members
                  </Typography>
                </Box>
              </Stack>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              sx={{
                position: "relative",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: 400,
              }}
            >
              {/* Decorative circles */}
              <Box
                sx={{
                  position: "absolute",
                  width: 300,
                  height: 300,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${theme.palette.primary.light}20 0%, ${theme.palette.primary.main}30 100%)`,
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  width: 200,
                  height: 200,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${theme.palette.secondary.light}20 0%, ${theme.palette.secondary.main}30 100%)`,
                  top: "20%",
                  right: "10%",
                }}
              />
              {/* Icon representation */}
              <Box
                sx={{
                  position: "relative",
                  textAlign: "center",
                  p: 4,
                  background: theme.palette.background.paper,
                  borderRadius: 3,
                  boxShadow: "0 20px 60px rgba(31, 79, 212, 0.15)",
                  maxWidth: 320,
                }}
              >
                <Typography
                  sx={{
                    fontSize: "4rem",
                    mb: 2,
                  }}
                >
                  💰
                </Typography>
                <Typography variant="h2" gutterBottom>
                  Savings Circle
                </Typography>
                <Typography color="text.secondary">
                  5 members • 500 XLM each • 3 month cycle
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  justifyContent="center"
                  sx={{ mt: 2 }}
                >
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Box
                      key={i}
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background:
                          i <= 2
                            ? "primary.main"
                            : i === 3
                            ? "secondary.main"
                            : "divider",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: i <= 2 ? "white" : "text.secondary",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      {i <= 2 ? "✓" : i}
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Container>

      {/* Features Section */}
      <Box sx={{ py: { xs: 6, md: 10 }, background: theme.palette.background.paper }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: "center", mb: 6 }}>
            <Typography
              sx={{
                color: "primary.main",
                fontWeight: 600,
                fontSize: "0.875rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                mb: 1,
              }}
            >
              Why Choose Us
            </Typography>
            <Typography variant="h1" sx={{ mb: 2 }}>
              Built for Trust and Transparency
            </Typography>
            <Typography
              color="text.secondary"
              sx={{ maxWidth: 600, mx: "auto" }}
            >
              Our platform leverages Stellar's blockchain technology to ensure
              every transaction is secure, transparent, and instant.
            </Typography>
          </Box>
          <Grid container spacing={3}>
            {[
              {
                icon: "🔒",
                title: "Secure & Transparent",
                description:
                  "All contributions and payouts are recorded on-chain. Everyone can verify the group status at any time.",
              },
              {
                icon: "⚡",
                title: "Instant Transactions",
                description:
                  "No waiting days for payments. Stellar's network processes transactions in seconds with minimal fees.",
              },
              {
                icon: "🤝",
                title: "Community Driven",
                description:
                  "Join existing groups or create your own with friends, family, or community members.",
              },
              {
                icon: "📊",
                title: "Track Everything",
                description:
                  "View your contribution history, cycle progress, and upcoming payouts all in one place.",
              },
              {
                icon: "🔔",
                title: "Smart Notifications",
                description:
                  "Get notified about upcoming contributions, payouts, and group status changes.",
              },
              {
                icon: "🌍",
                title: "Global Access",
                description:
                  "Anyone with a Stellar wallet can participate. No borders, no barriers.",
              },
            ].map((feature, index) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                <AppCard
                  sx={{
                    height: "100%",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: "0 12px 24px rgba(31, 79, 212, 0.1)",
                    },
                  }}
                >
                  <Stack spacing={2}>
                    <Typography sx={{ fontSize: "2.5rem" }}>
                      {feature.icon}
                    </Typography>
                    <Typography variant="h2">{feature.title}</Typography>
                    <Typography color="text.secondary">
                      {feature.description}
                    </Typography>
                  </Stack>
                </AppCard>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* How It Works Section */}
      <Box sx={{ py: { xs: 6, md: 10 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: "center", mb: 6 }}>
            <Typography
              sx={{
                color: "primary.main",
                fontWeight: 600,
                fontSize: "0.875rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                mb: 1,
              }}
            >
              How It Works
            </Typography>
            <Typography variant="h1" sx={{ mb: 2 }}>
              Simple Steps to Start Saving
            </Typography>
            <Typography
              color="text.secondary"
              sx={{ maxWidth: 600, mx: "auto" }}
            >
              Joining a savings circle is easy. Connect your wallet, find a
              group, and start your journey to financial freedom.
            </Typography>
          </Box>
          <Grid container spacing={3}>
            {[
              {
                step: "01",
                icon: "🔗",
                title: "Connect Wallet",
                description:
                  "Link your Stellar wallet using Freighter or another supported wallet.",
              },
              {
                step: "02",
                icon: "👥",
                title: "Join or Create Group",
                description:
                  "Browse existing groups or create your own with custom settings.",
              },
              {
                step: "03",
                icon: "💰",
                title: "Make Contributions",
                description:
                  "Contribute your agreed amount each cycle. All transactions are on-chain.",
              },
              {
                step: "04",
                icon: "🎁",
                title: "Receive Payout",
                description:
                  "When it's your turn, receive the complete pool instantly to your wallet.",
              },
            ].map((step, index) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
                <Box
                  sx={{
                    textAlign: "center",
                    p: 3,
                    height: "100%",
                    position: "relative",
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "4rem",
                      fontWeight: 800,
                      color: "primary.light",
                      opacity: 0.3,
                      position: "absolute",
                      top: 0,
                      left: "50%",
                      transform: "translateX(-50%)",
                    }}
                  >
                    {step.step}
                  </Typography>
                  <Box sx={{ position: "relative", pt: 4 }}>
                    <Typography sx={{ fontSize: "3rem", mb: 2 }}>
                      {step.icon}
                    </Typography>
                    <Typography variant="h2" sx={{ mb: 1 }}>
                      {step.title}
                    </Typography>
                    <Typography color="text.secondary">
                      {step.description}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box
        sx={{
          py: { xs: 6, md: 10 },
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
        }}
      >
        <Container maxWidth="md">
          <AppCard
            sx={{
              textAlign: "center",
              p: { xs: 4, md: 6 },
              background: "rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            <Stack spacing={3} alignItems="center">
              <Typography
                variant="h1"
                sx={{ color: "white", fontSize: { xs: "2rem", md: "2.5rem" } }}
              >
                Ready to Start Saving?
              </Typography>
              <Typography
                sx={{
                  color: "rgba(255, 255, 255, 0.8)",
                  maxWidth: 400,
                }}
              >
                Join thousands of members already saving together. Connect your
                wallet to get started today.
              </Typography>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{ pt: 2 }}
              >
                <AppButton
                  variant="contained"
                  size="large"
                  sx={{
                    background: "white",
                    color: "primary.main",
                    "&:hover": {
                      background: "rgba(255, 255, 255, 0.9)",
                    },
                  }}
                >
                  Connect Wallet
                </AppButton>
                <AppButton
                  variant="outlined"
                  size="large"
                  sx={{
                    borderColor: "white",
                    color: "white",
                    "&:hover": {
                      background: "rgba(255, 255, 255, 0.1)",
                    },
                  }}
                >
                  Learn More
                </AppButton>
              </Stack>
            </Stack>
          </AppCard>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 4,
          px: 3,
          background: theme.palette.background.paper,
          borderTop: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Container maxWidth="lg">
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems="center"
            spacing={2}
          >
            <Typography variant="body2" color="text.secondary">
              © 2024 Stellar Save. Built on Stellar.
            </Typography>
            <Stack direction="row" spacing={3}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ cursor: "pointer", "&:hover": { color: "primary.main" } }}
              >
                Terms
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ cursor: "pointer", "&:hover": { color: "primary.main" } }}
              >
                Privacy
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ cursor: "pointer", "&:hover": { color: "primary.main" } }}
              >
                Docs
              </Typography>
            </Stack>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}