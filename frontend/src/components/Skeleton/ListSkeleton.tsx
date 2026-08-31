import { Skeleton } from "@mui/material";

interface ListSkeletonProps {
  items?: number;
  height?: number;
}

export function ListSkeleton({ items = 5, height = 60 }: ListSkeletonProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {Array.from({ length: items }).map((_, i) => (
        <Skeleton key={i} variant="rectangular" width="100%" height={height} />
      ))}
    </div>
  );
}
