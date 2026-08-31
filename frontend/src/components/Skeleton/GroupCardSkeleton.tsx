import { Skeleton } from "@mui/material";

export function GroupCardSkeleton() {
  return (
    <div
      style={{
        border: "1px solid #333",
        borderRadius: "12px",
        backgroundColor: "#1a1a1a",
        overflow: "hidden",
        width: "100%",
      }}
    >
      {/* Image */}
      <Skeleton variant="rectangular" width="100%" height={160} />

      {/* Header: title + badge */}
      <div
        style={{
          padding: "1em 1.5em 0.5em",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1em",
        }}
      >
        <Skeleton variant="text" width="55%" height={28} />
        <Skeleton variant="rounded" width={64} height={24} />
      </div>

      {/* Description */}
      <div style={{ padding: "0.25em 1.5em 0.75em" }}>
        <Skeleton variant="text" width="90%" height={16} />
        <Skeleton variant="text" width="70%" height={16} />
      </div>

      {/* Stats */}
      <div
        style={{
          padding: "0.75em 1.5em",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1em",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3em" }}>
          <Skeleton variant="text" width="70%" height={13} />
          <Skeleton variant="text" width="50%" height={24} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3em" }}>
          <Skeleton variant="text" width="80%" height={13} />
          <Skeleton variant="text" width="60%" height={24} />
        </div>
      </div>

      {/* Footer buttons */}
      <div
        style={{
          padding: "0.75em 1.5em 1em",
          borderTop: "1px solid #333",
          display: "flex",
          justifyContent: "flex-end",
          gap: "0.75em",
        }}
      >
        <Skeleton variant="rounded" width={110} height={36} />
        <Skeleton variant="rounded" width={100} height={36} />
      </div>
    </div>
  );
}
