import { LucideIcon } from "lucide-react";

type Props = {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "primary" | "accent" | "success" | "warning";
};

const tones = {
  primary: "from-primary/15 to-primary/5 text-primary",
  accent: "from-accent/15 to-accent/5 text-accent",
  success: "from-success/15 to-success/5 text-success",
  warning: "from-warning/20 to-warning/5 text-warning-foreground",
};

const StatCard = ({ label, value, hint, icon: Icon, tone = "primary" }: Props) => (
  <div className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-card transition-shadow hover:shadow-soft sm:p-5">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium leading-tight text-muted-foreground sm:text-sm">{label}</p>
        <p className="mt-1.5 truncate font-display text-xl font-bold tracking-tight sm:mt-2 sm:text-3xl">{value}</p>
        {hint && (
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground sm:mt-1 sm:text-xs">{hint}</p>
        )}
      </div>
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br sm:h-11 sm:w-11 ${tones[tone]}`}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
    </div>
  </div>
);

export default StatCard;
