import { lazy, Suspense } from "react";
import { Box, CircularProgress } from "@mui/material";
import "./App.css";

const AppRouter = lazy(() =>
  import("./routing/AppRouter").then((m) => ({ default: m.AppRouter }))
);

function RouteLoadingFallback() {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
      }}
    >
      <CircularProgress />
    </Box>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <AppRouter />
    </Suspense>
  );
}
