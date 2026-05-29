import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "12px",
  fontSize: "12px",
  boxShadow: "0 4px 20px -8px hsl(var(--primary) / 0.18)",
};

const labelStyle = { color: "hsl(var(--muted-foreground))", fontSize: "11px" };
const axisStyle = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };

export const RevenueChart = ({ data }: { data: any[] }) => (
  <div className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-card sm:p-5">
    <div className="mb-3 flex items-baseline justify-between gap-2 sm:mb-4">
      <h3 className="text-sm font-bold sm:text-base">Ingresos por día</h3>
      <span className="shrink-0 text-[10px] text-muted-foreground sm:text-xs">Última semana</span>
    </div>
    <div className="h-48 sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data || []} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={labelStyle}
            formatter={(v: number) => [new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v), "Ingresos"]}
          />
          <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#revGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export const HoursChart = ({ data }: { data: any[] }) => (
  <div className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-card sm:p-5">
    <div className="mb-3 flex items-baseline justify-between gap-2 sm:mb-4">
      <h3 className="text-sm font-bold sm:text-base">Pedidos por hora</h3>
      <span className="shrink-0 text-[10px] text-muted-foreground sm:text-xs">Hoy</span>
    </div>
    <div className="h-48 sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data || []} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary-glow))" />
              <stop offset="100%" stopColor="hsl(var(--primary))" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
          <Bar dataKey="orders" fill="url(#barGrad)" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export const TopBusinessesChart = ({ data }: { data: any[] }) => (
  <div className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-card sm:p-5">
    <div className="mb-3 flex items-baseline justify-between gap-2 sm:mb-4">
      <h3 className="text-sm font-bold sm:text-base">Top negocios</h3>
      <span className="shrink-0 text-[10px] text-muted-foreground sm:text-xs">Por ingresos</span>
    </div>
    <div className="h-52 sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data || []} layout="vertical" margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <YAxis type="category" dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} width={110} />
          <Tooltip 
            contentStyle={tooltipStyle} 
            labelStyle={labelStyle} 
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
            formatter={(v: number) => [new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v), "Ingresos"]}
          />
          <Bar dataKey="revenue" fill="hsl(var(--accent))" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);
