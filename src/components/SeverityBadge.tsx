import { cn } from "@/lib/utils";

interface SeverityBadgeProps {
  severity: "Low" | "Moderate" | "High";
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        severity === "Low" && "bg-success/15 text-success",
        severity === "Moderate" && "bg-warning/15 text-warning",
        severity === "High" && "bg-destructive/15 text-destructive"
      )}
    >
      {severity}
    </span>
  );
}
