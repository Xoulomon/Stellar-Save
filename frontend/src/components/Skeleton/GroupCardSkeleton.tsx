import { Skeleton } from "./Skeleton";
import "./Skeleton.css";

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
      {/* Header */}
      <div
        style={{
          padding: "1.2em 1.5em",
          borderBottom: "1px solid #333",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1em",
        }}
      >
        <Skeleton variant="text" width="60%" height={24} />
        <Skeleton variant="rounded" width={60} height={24} />
      </div>

      {/* Body */}
      <div style={{ padding: "1.5em" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "1.5em",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4em" }}>
            <Skeleton variant="text" width="80%" height={14} />
            <Skeleton variant="text" width="50%" height={28} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4em" }}>
            <Skeleton variant="text" width="80%" height={14} />
            <Skeleton variant="text" width="70%" height={28} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "1em 1.5em",
          borderTop: "1px solid #333",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "0.8em",
        }}
      >
        <Skeleton variant="rounded" width={100} height={36} />
        <Skeleton variant="rounded" width={100} height={36} />
      </div>
    </div>
  );
}
