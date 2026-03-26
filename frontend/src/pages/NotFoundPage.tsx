import { Box, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { AppButton, AppCard } from "../ui";
import NotFoundIllustration from "../svg/page-not-found.svg";

/**
 * 404 Not Found page component
 * Displays when user navigates to an undefined route
 */
export default function NotFoundPage() {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate("/");
  };

  const handleGoToAbout = () => {
    navigate("/about");
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 3,
      }}
    >
      <AppCard
        sx={{
          maxWidth: 620,
          width: "100%",
          textAlign: "center",
          py: 6,
        }}
      >
        <Stack spacing={2} alignItems="center">
          {/* Illustration */}
          <Box
            component="img"
            src={NotFoundIllustration}
            alt="404 Illustration"
            sx={{ 
              width: "100%", 
              maxWidth: 380,
              mb: 2 
            }}
          />

          {/* Content */}
          <Box sx={{ position: "relative", top: "-30px" }}>
            <Typography 
              variant="h1" 
              component="h1" 
              fontWeight={700}
              sx={{ fontSize: { xs: "4.5rem", md: "6rem" }, color: "text.primary" }}
            >
              404
            </Typography>

            <Typography variant="h4" gutterBottom sx={{ mt: 1 }}>
              Page Not Found
            </Typography>

            <Typography 
              color="text.secondary" 
              sx={{ mb: 5, maxWidth: 420, mx: "auto" }}
            >
              Oops! The page you're looking for doesn't exist or has been moved.
            </Typography>

            {/* Action Buttons */}
            <Stack 
              direction={{ xs: "column", sm: "row" }} 
              spacing={2}
              justifyContent="center"
            >
              <AppButton 
                onClick={handleGoHome} 
                size="large"
                variant="contained"
              >
                Go Back Home
              </AppButton>

              <AppButton 
                onClick={handleGoToAbout} 
                size="large"
                variant="outlined"
              >
                Learn About Us
              </AppButton>
            </Stack>
          </Box>
        </Stack>
      </AppCard>
    </Box>
  );
}