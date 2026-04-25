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
  <div className="rounded-2xl bg-card border border-border/60 p-5 shadow-card hover:shadow-soft transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <p className="mt-2 text-3xl font-display font-bold tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className={`grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

export default StatCard;
