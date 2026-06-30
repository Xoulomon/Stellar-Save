import { Box, Container, Grid, Stack, Typography, useTheme } from "@mui/material";
import { AppButton } from "../ui/components/AppButton";
import { AppCard } from "../ui/components/AppCard";

/**
 * LandingPage — Full landing page for issue #436
 * Sections: Nav, Hero, ROSCA Explanation, Features, How It Works, Testimonials, CTA, Footer
 * Responsive: mobile / tablet / desktop
 * Accessibility: semantic HTML, aria-labels, skip-to-content link
 */
export default function LandingPage() {
  const theme = useTheme();

  return (
    <Box sx={{ minHeight: "100vh", background: theme.palette.background.default }}>

      {/* Skip to main content — accessibility */}
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: "absolute",
          left: "-9999px",
          top: "auto",
          width: 1,
          height: 1,
          overflow: "hidden",
          "&:focus": {
            position: "fixed",
            top: 8,
            left: 8,
            width: "auto",
            height: "auto",
            p: 1,
            background: "primary.main",
            color: "white",
            zIndex: 9999,
            borderRadius: 1,
          },
        }}
      >
        Skip to main content
      </Box>

      {/* ── Navigation ── */}
      <Box
        component="header"
        role="banner"
        sx={{
          py: 2,
          px: 3,
          borderBottom: `1px solid ${theme.palette.divider}`,
          background: theme.palette.background.paper,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <Container maxWidth="lg">
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h2" sx={{ color: "primary.main", fontWeight: 700 }} aria-label="Stellar Save home">
              Stellar Save
            </Typography>
            <Stack component="nav" aria-label="Main navigation" direction="row" spacing={2}>
              <AppButton variant="text" size="small" href="#how-it-works">How It Works</AppButton>
              <AppButton variant="text" size="small" href="#features">Features</AppButton>
              <AppButton variant="text" size="small" href="#testimonials">Testimonials</AppButton>
              <AppButton variant="outlined" size="small" aria-label="Connect your Stellar wallet">Connect Wallet</AppButton>
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* ── Main ── */}
      <Box component="main" id="main-content">

        {/* ── Hero ── */}
        <Box
          component="section"
          aria-labelledby="hero-heading"
          sx={{
            py: { xs: 8, md: 14 },
            background: `linear-gradient(160deg, ${theme.palette.background.default} 0%, ${theme.palette.background.paper} 100%)`,
          }}
        >
          <Container maxWidth="lg">
            <Grid container spacing={6} alignItems="center">
              <Grid size={{ xs: 12, md: 6 }}>
                <Stack spacing={3}>
                  <Typography
                    sx={{ color: "primary.main", fontWeight: 600, fontSize: "0.875rem", letterSpacing: "0.1em", textTransform: "uppercase" }}
                  >
                    Community Savings on Stellar
                  </Typography>
                  <Typography id="hero-heading" variant="h1" sx={{ fontSize: { xs: "2.5rem", md: "3.5rem" }, lineHeight: 1.1 }}>
                    Save Together,<br />Win Together
                  </Typography>
                  <Typography variant="body1" sx={{ color: "text.secondary", fontSize: { xs: "1rem", md: "1.125rem" }, maxWidth: 480 }}>
                    Join community savings circles (ROSCAs) where everyone contributes equally
                    and takes turns receiving the pool — built on Stellar for transparent,
                    secure, and instant transactions.
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ pt: 1 }}>
                    <AppButton variant="contained" size="large" aria-label="Get started with Stellar Save">Get Started</AppButton>
                    <AppButton variant="outlined" size="large" href="#how-it-works" aria-label="Learn how Stellar Save works">How It Works</AppButton>
                  </Stack>
                  <Stack direction="row" spacing={4} sx={{ pt: 2 }} role="list" aria-label="Platform statistics">
                    {[
                      { value: "2.5M+", label: "Total Saved" },
                      { value: "10K+", label: "Active Groups" },
                      { value: "50K+", label: "Members" },
                    ].map((stat) => (
                      <Box key={stat.label} role="listitem">
                        <Typography variant="h2" sx={{ color: "primary.main" }}>{stat.value}</Typography>
                        <Typography variant="body2" color="text.secondary">{stat.label}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box
                  sx={{
                    p: 4,
                    background: theme.palette.background.paper,
                    borderRadius: 3,
                    boxShadow: "0 20px 60px rgba(31,79,212,0.12)",
                    maxWidth: 360,
                    mx: "auto",
                    textAlign: "center",
                  }}
                  aria-label="Example savings circle preview"
                >
                  <Typography sx={{ fontSize: "4rem", mb: 2 }} role="img" aria-label="Money bag">💰</Typography>
                  <Typography variant="h2" gutterBottom>Savings Circle</Typography>
                  <Typography color="text.secondary">5 members · 500 XLM each · 3-month cycle</Typography>
                  <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }} role="list" aria-label="Member contribution status">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Box
                        key={i}
                        role="listitem"
                        aria-label={i <= 2 ? `Member ${i} contributed` : `Member ${i} pending`}
                        sx={{
                          width: 36, height: 36, borderRadius: "50%",
                          background: i <= 2 ? theme.palette.primary.main : theme.palette.divider,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: i <= 2 ? "white" : "text.secondary",
                          fontSize: "0.75rem", fontWeight: 600,
                        }}
                      >
                        {i <= 2 ? "✓" : i}
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* ── ROSCA Explanation ── */}
        <Box
          component="section"
          id="rosca"
          aria-labelledby="rosca-heading"
          sx={{ py: { xs: 6, md: 10 }, background: theme.palette.background.paper }}
        >
          <Container maxWidth="md">
            <Box sx={{ textAlign: "center", mb: 5 }}>
              <Typography sx={{ color: "primary.main", fontWeight: 600, fontSize: "0.875rem", letterSpacing: "0.1em", textTransform: "uppercase", mb: 1 }}>
                What is a ROSCA?
              </Typography>
              <Typography id="rosca-heading" variant="h1" sx={{ mb: 2 }}>
                Rotating Savings & Credit Association
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: "1.1rem", maxWidth: 600, mx: "auto" }}>
                A ROSCA is a trusted community savings model used by millions worldwide.
                A group of people agree to contribute a fixed amount each cycle.
                Each cycle, one member receives the entire pool — rotating until everyone has received their payout.
              </Typography>
            </Box>
            <Grid container spacing={3} justifyContent="center">
              {[
                { icon: "🤝", title: "Trusted by Communities", desc: "ROSCAs have been used for centuries across Africa, Asia, Latin America, and beyond." },
                { icon: "🔄", title: "Rotating Payouts", desc: "Every member contributes each cycle. Every member receives the pool exactly once." },
                { icon: "🔗", title: "Now On-Chain", desc: "Stellar Save brings this proven model on-chain — transparent, automated, and trustless." },
              ].map((item) => (
                <Grid size={{ xs: 12, sm: 4 }} key={item.title}>
                  <Box sx={{ textAlign: "center", p: 2 }}>
                    <Typography sx={{ fontSize: "2.5rem", mb: 1 }} role="img" aria-label={item.title}>{item.icon}</Typography>
                    <Typography variant="h2" sx={{ mb: 1 }}>{item.title}</Typography>
                    <Typography color="text.secondary">{item.desc}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* ── Features ── */}
        <Box
          component="section"
          id="features"
          aria-labelledby="features-heading"
          sx={{ py: { xs: 6, md: 10 } }}
        >
          <Container maxWidth="lg">
            <Box sx={{ textAlign: "center", mb: 6 }}>
              <Typography sx={{ color: "primary.main", fontWeight: 600, fontSize: "0.875rem", letterSpacing: "0.1em", textTransform: "uppercase", mb: 1 }}>
                Why Choose Us
              </Typography>
              <Typography id="features-heading" variant="h1" sx={{ mb: 2 }}>Built for Trust and Transparency</Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 600, mx: "auto" }}>
                Stellar Save leverages blockchain technology to ensure every transaction is secure, transparent, and instant.
              </Typography>
            </Box>
            <Grid container spacing={3}>
              {[
                { icon: "🔒", title: "Secure & Transparent", desc: "All contributions and payouts are recorded on-chain. Anyone can verify group status at any time." },
                { icon: "⚡", title: "Instant Transactions", desc: "Stellar processes transactions in seconds with minimal fees — no waiting days for payments." },
                { icon: "🪙", title: "Multi-Token Support", desc: "Save in XLM, USDC, EURC, or any SEP-41 token. Choose the currency that works for your group." },
                { icon: "📊", title: "Track Everything", desc: "View contribution history, cycle progress, and upcoming payouts all in one dashboard." },
                { icon: "🔔", title: "Smart Notifications", desc: "Get notified about upcoming contributions, payouts, and group status changes." },
                { icon: "🌍", title: "Global Access", desc: "Anyone with a Stellar wallet can participate. No borders, no barriers." },
              ].map((feature) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={feature.title}>
                  <AppCard
                    sx={{
                      height: "100%",
                      transition: "transform 0.2s, box-shadow 0.2s",
                      "&:hover": { transform: "translateY(-4px)", boxShadow: "0 12px 24px rgba(31,79,212,0.1)" },
                    }}
                  >
                    <Stack spacing={2}>
                      <Typography sx={{ fontSize: "2.5rem" }} role="img" aria-label={feature.title}>{feature.icon}</Typography>
                      <Typography variant="h2">{feature.title}</Typography>
                      <Typography color="text.secondary">{feature.desc}</Typography>
                    </Stack>
                  </AppCard>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* ── How It Works ── */}
        <Box
          component="section"
          id="how-it-works"
          aria-labelledby="how-heading"
          sx={{ py: { xs: 6, md: 10 }, background: theme.palette.background.paper }}
        >
          <Container maxWidth="lg">
            <Box sx={{ textAlign: "center", mb: 6 }}>
              <Typography sx={{ color: "primary.main", fontWeight: 600, fontSize: "0.875rem", letterSpacing: "0.1em", textTransform: "uppercase", mb: 1 }}>
                How It Works
              </Typography>
              <Typography id="how-heading" variant="h1" sx={{ mb: 2 }}>Simple Steps to Start Saving</Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 600, mx: "auto" }}>
                Connect your wallet, find a group, and start your journey to financial freedom.
              </Typography>
            </Box>
            <Grid container spacing={3}>
              {[
                { step: "01", icon: "🔗", title: "Connect Wallet", desc: "Link your Stellar wallet using Freighter or another supported wallet." },
                { step: "02", icon: "👥", title: "Join or Create Group", desc: "Browse existing groups or create your own with custom settings and token." },
                { step: "03", icon: "💰", title: "Make Contributions", desc: "Contribute your agreed amount each cycle. All transactions are on-chain." },
                { step: "04", icon: "🎁", title: "Receive Payout", desc: "When it's your turn, receive the complete pool instantly to your wallet." },
              ].map((step) => (
                <Grid size={{ xs: 12, sm: 6, md: 3 }} key={step.step}>
                  <Box sx={{ textAlign: "center", p: 3, position: "relative" }} aria-label={`Step ${step.step}: ${step.title}`}>
                    <Typography
                      aria-hidden="true"
                      sx={{ fontSize: "4rem", fontWeight: 800, color: "primary.light", opacity: 0.2, position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)" }}
                    >
                      {step.step}
                    </Typography>
                    <Box sx={{ position: "relative", pt: 4 }}>
                      <Typography sx={{ fontSize: "3rem", mb: 2 }} role="img" aria-label={step.title}>{step.icon}</Typography>
                      <Typography variant="h2" sx={{ mb: 1 }}>{step.title}</Typography>
                      <Typography color="text.secondary">{step.desc}</Typography>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* ── Testimonials ── */}
        <Box
          component="section"
          id="testimonials"
          aria-labelledby="testimonials-heading"
          sx={{ py: { xs: 6, md: 10 } }}
        >
          <Container maxWidth="lg">
            <Box sx={{ textAlign: "center", mb: 6 }}>
              <Typography sx={{ color: "primary.main", fontWeight: 600, fontSize: "0.875rem", letterSpacing: "0.1em", textTransform: "uppercase", mb: 1 }}>
                Testimonials
              </Typography>
              <Typography id="testimonials-heading" variant="h1" sx={{ mb: 2 }}>What Our Members Say</Typography>
            </Box>
            <Grid container spacing={3}>
              {[
                { name: "Amara K.", location: "Lagos, Nigeria", quote: "I've been part of traditional ajo groups my whole life. Stellar Save brings that same trust but with full transparency — I can see every transaction on-chain.", avatar: "🧑🏾" },
                { name: "Sofia R.", location: "Mexico City, Mexico", quote: "Our tanda group used to rely on trust alone. Now with Stellar Save, the smart contract handles everything automatically. No more disputes.", avatar: "👩🏽" },
                { name: "James T.", location: "London, UK", quote: "I joined a USDC savings circle with colleagues from 5 different countries. The multi-token support made it seamless for everyone.", avatar: "👨🏻" },
              ].map((t) => (
                <Grid size={{ xs: 12, md: 4 }} key={t.name}>
                  <AppCard sx={{ height: "100%" }}>
                    <Stack spacing={2}>
                      <Typography sx={{ fontSize: "2rem" }} role="img" aria-label={`${t.name} avatar`}>{t.avatar}</Typography>
                      <Typography color="text.secondary" sx={{ fontStyle: "italic", lineHeight: 1.7 }}>
                        "{t.quote}"
                      </Typography>
                      <Box>
                        <Typography variant="h2" sx={{ fontSize: "1rem" }}>{t.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{t.location}</Typography>
                      </Box>
                    </Stack>
                  </AppCard>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* ── CTA ── */}
        <Box
          component="section"
          aria-labelledby="cta-heading"
          sx={{
            py: { xs: 6, md: 10 },
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          }}
        >
          <Container maxWidth="md">
            <Box sx={{ textAlign: "center", p: { xs: 4, md: 6 } }}>
              <Stack spacing={3} alignItems="center">
                <Typography id="cta-heading" variant="h1" sx={{ color: "white", fontSize: { xs: "2rem", md: "2.5rem" } }}>
                  Ready to Start Saving?
                </Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.85)", maxWidth: 420 }}>
                  Join thousands of members already saving together. Connect your wallet to get started today.
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ pt: 1 }}>
                  <AppButton
                    variant="contained"
                    size="large"
                    aria-label="Connect wallet to get started"
                    sx={{ background: "white", color: "primary.main", "&:hover": { background: "rgba(255,255,255,0.9)" } }}
                  >
                    Connect Wallet
                  </AppButton>
                  <AppButton
                    variant="outlined"
                    size="large"
                    href="#features"
                    aria-label="Learn more about Stellar Save features"
                    sx={{ borderColor: "white", color: "white", "&:hover": { background: "rgba(255,255,255,0.1)" } }}
                  >
                    Learn More
                  </AppButton>
                </Stack>
              </Stack>
            </Box>
          </Container>
        </Box>

      </Box>{/* end main */}

      {/* ── Footer ── */}
      <Box
        component="footer"
        role="contentinfo"
        sx={{ py: 4, px: 3, background: theme.palette.background.paper, borderTop: `1px solid ${theme.palette.divider}` }}
      >
        <Container maxWidth="lg">
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="center" spacing={2}>
            <Typography variant="body2" color="text.secondary">
              © 2024 Stellar Save. Built on Stellar.
            </Typography>
            <Stack component="nav" aria-label="Footer navigation" direction="row" spacing={3}>
              {["Terms", "Privacy", "Docs"].map((link) => (
                <Typography
                  key={link}
                  component="a"
                  href="#"
                  variant="body2"
                  color="text.secondary"
                  sx={{ textDecoration: "none", "&:hover": { color: "primary.main" } }}
                >
                  {link}
                </Typography>
              ))}
            </Stack>
          </Stack>
        </Container>
      </Box>

    </Box>
  );
}
