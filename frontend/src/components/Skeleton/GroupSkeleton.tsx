import React from "react";
import { Skeleton } from "./Skeleton";
import "./Skeleton.css";

export const GroupSkeleton: React.FC = () => {
  return (
    <div
      style={{ display: "flex", gap: 12, alignItems: "center", width: "100%" }}
    >
      <Skeleton variant="avatar" width={56} height={56} />
      <div style={{ flex: 1 }}>
        <Skeleton variant="text" width="60%" style={{ marginBottom: 8 }} />
        <Skeleton variant="text" width="40%" />
      </div>
    </div>
  );
};

export default GroupSkeleton;
