import "./Card.css";

type CardVariant = "default" | "outlined" | "elevated";

interface CardProps {
  variant?: CardVariant;
  hoverable?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
}

export function Card({
  variant = "default",
  hoverable = false,
  header,
  footer,
  children,
  className = "",
  onClick,
  ariaLabel,
}: CardProps) {
  const classes = [
    "card",
    `card-${variant}`,
    hoverable ? "card-hoverable" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={classes}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={handleKeyDown}
      aria-label={onClick ? ariaLabel : undefined}
    >
      {header && <div className="card-header">{header}</div>}
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}
