import { Box, useTheme } from '@mui/material';

import {
  CtaSection,
  FeaturesSection,
  HeroSection,
  HowItWorksSection,
  LandingFooter,
  LandingNav,
  RoscaSection,
  SkipLink,
  TestimonialsSection,
} from '@/components/landing';

/**
 * LandingPage — Full landing page for issue #436
 * Sections: Nav, Hero, ROSCA Explanation, Features, How It Works, Testimonials, CTA, Footer
 * Responsive: mobile / tablet / desktop
 * Accessibility: semantic HTML, aria-labels, skip-to-content link
 *
 * The page is a composition layer only; each section lives in
 * `components/landing/`.
 */
export default function LandingPage() {
  const theme = useTheme();

  return (
    <Box sx={{ minHeight: '100vh', background: theme.palette.background.default }}>
      <SkipLink />

      <LandingNav />

      {/* ── Main ── */}
      <Box component="main" id="main-content">
        <HeroSection />
        <RoscaSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <CtaSection />
      </Box>
      {/* end main */}

      <LandingFooter />
    </Box>
  );
}
