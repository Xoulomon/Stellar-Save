import React from "react";
import { Skeleton } from "./Skeleton";
import "./Skeleton.css";

export const ContributionSkeleton: React.FC = () => {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Skeleton variant="avatar" width={40} height={40} />
        <div style={{ flex: 1 }}>
          <Skeleton variant="text" width="50%" style={{ marginBottom: 6 }} />
          <Skeleton variant="text" width="30%" />
        </div>
      </div>
      <Skeleton variant="card" width="100%" height={96} />
      <div style={{ display: "flex", gap: 8 }}>
        <Skeleton variant="text" width="30%" />
        <Skeleton variant="text" width="20%" />
      </div>
    </div>
  );
};

export default ContributionSkeleton;
