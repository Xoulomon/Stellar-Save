import { Box } from "@mui/material";
import { lazy, Suspense } from "react";

import "./App.css";
import { CardSkeleton } from "./components/Skeleton";
import { useOfflineSyncInit } from "./hooks/offline";
import { useDeepLink } from "./hooks/useDeepLink";

const AppRouter = lazy(() =>
  import("./routing/AppRouter").then((m) => ({ default: m.AppRouter }))
);

function RouteLoadingFallback() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", p: 2 }}>
      <Box sx={{ width: "100%", maxWidth: 400 }}>
        <CardSkeleton height={300} lines={3} />
      </Box>
    </Box>
  );
}

export default function App() {
  // Initialize deep link handler
  useDeepLink();

  return (
    <>
      <Suspense fallback={<RouteLoadingFallback />}>
        <AppRouter />
      </Suspense>
      <FeedbackWidget />
    </>
  );
}
