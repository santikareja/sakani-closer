import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { ClockIcon } from "@phosphor-icons/react/dist/ssr/Clock";
import { InfoIcon } from "@phosphor-icons/react/dist/ssr/Info";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr/WarningCircle";

export type StatusBadgeTone = "success" | "warning" | "danger" | "neutral" | "info";

const iconMap = {
  success: CheckCircleIcon,
  warning: ClockIcon,
  danger: WarningCircleIcon,
  neutral: InfoIcon,
  info: InfoIcon,
} as const;

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: StatusBadgeTone;
}) {
  const IconComponent = iconMap[tone];
  return (
    <span className={`status-badge status-badge-${tone}`}>
      <IconComponent size={14} weight="bold" aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}
