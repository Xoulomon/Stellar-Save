import { Skeleton } from "@mui/material";

interface TextSkeletonProps {
  lines?: number;
  width?: string | number;
  height?: number;
}

export function TextSkeleton({ lines = 3, width = "100%", height = 16 }: TextSkeletonProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 ? "70%" : width}
          height={height}
        />
      ))}
    </div>
  );
}
