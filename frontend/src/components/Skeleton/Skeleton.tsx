import React from "react";
import type { CSSProperties } from "react";
import "./Skeleton.css";

type Variant = "text" | "rect" | "circle" | "avatar" | "card";

interface SkeletonProps {
  variant?: Variant;
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: CSSProperties;
  animation?: boolean;
  rounded?: boolean;
}

const toCssSize = (v?: string | number) => {
  if (v === undefined) return undefined;
  return typeof v === "number" ? `${v}px` : v;
};

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = "text",
  width,
  height,
  className = "",
  style,
  animation = true,
  rounded = false,
}) => {
  const cssVarsRaw: Record<string, string | number | undefined> = {
    "--skeleton-width": toCssSize(width),
    "--skeleton-height": toCssSize(height),
  };

  const cssVars = {
    ...(style as unknown as Record<string, string | number | undefined>),
    ...cssVarsRaw,
  } as unknown as CSSProperties;

  const classes = ["skeleton", `skeleton--${variant}`];
  if (animation) classes.push("skeleton--animated");
  if (rounded) classes.push("skeleton--rounded");
  if (className) classes.push(className);

  return <div className={classes.join(" ")} style={cssVars} aria-hidden />;
};

export default Skeleton;
