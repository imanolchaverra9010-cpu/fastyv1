import { formatCOP } from "@/data/mock";
import { BusinessStats, Order, BusinessContextType } from "@/types/business";
import { useOutletContext } from "react-router-dom";

export const StatsTab = () => {
  const { stats, orders } = useOutletContext<BusinessContextType>();
  const deliveredOrders = orders.filter(o => o.status === "delivered");
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border/60 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-4">Productos Más Vendidos</h3>
          <div className="space-y-3">
            {stats?.top_products?.map((product, idx) => (
              <div key={idx} className="flex justify-between items-center pb-3 border-b border-border/60 last:border-0">
                <span className="font-medium">{product.name}</span>
                <span className="text-primary font-bold">{product.total_sold} vendidos</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-4">Resumen del Día</h3>
          <div className="space-y-4">
            <div>
              <p className="text-muted-foreground text-sm">Ingresos Totales</p>
              <p className="text-2xl font-bold text-primary">{formatCOP(stats?.revenue_today || 0)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Pedidos Completados</p>
              <p className="text-2xl font-bold">{deliveredOrders.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
