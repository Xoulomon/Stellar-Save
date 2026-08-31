import { Skeleton } from "@mui/material";

interface CardSkeletonProps {
  height?: number;
  lines?: number;
}

export function CardSkeleton({ height = 200, lines = 2 }: CardSkeletonProps) {
  return (
    <div
      style={{
        border: "1px solid #e0e0e0",
        borderRadius: "8px",
        padding: "16px",
        backgroundColor: "#f5f5f5",
      }}
    >
      {/* Card image/header */}
      <Skeleton variant="rectangular" width="100%" height={height} />

      {/* Card content */}
      <div style={{ marginTop: "12px" }}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            variant="text"
            width={i === lines - 1 ? "60%" : "100%"}
            height={16}
            sx={{ mb: 1 }}
          />
        ))}
      </div>
    </div>
  );
}
