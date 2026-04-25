import { OrderStatus, statusLabel, statusTone } from "@/data/mock";

const StatusBadge = ({ status }: { status: OrderStatus }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusTone[status]}`}>
    {statusLabel[status]}
  </span>
);

export default StatusBadge;
