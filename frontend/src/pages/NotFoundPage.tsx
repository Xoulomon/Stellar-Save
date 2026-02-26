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
          maxWidth: 600,
          width: "100%",
          textAlign: "center",
        }}
      >
        <Stack spacing={0} alignItems="center">
          <Box
            component="img"
            src={NotFoundIllustration}
            alt="404 Illustration"
            sx={{ width: "100%", maxWidth: 400 }}
          />

          <Box sx={{ position: "relative", top: "-50px", textAlign: "center" }}>
            <Typography variant="h2" gutterBottom>
              Page Not Found
            </Typography>

            <Typography color="text.secondary" sx={{ mt: 1, mb: 4 }}>
              The page you're looking for doesn't exist or has been moved.
            </Typography>

            <AppButton onClick={handleGoHome} size="large">
              Go to Home
            </AppButton>
          </Box>
        </Stack>
      </AppCard>
    </Box>
  );
}
