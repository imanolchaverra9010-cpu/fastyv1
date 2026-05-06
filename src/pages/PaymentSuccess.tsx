import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);

  const orderId = searchParams.get("order_id");

  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (!orderId) {
        setLoading(false);
        return;
      }

      try {
        // Check payment status
        const paymentResponse = await fetch(`/api/payments/${orderId}`);
        if (paymentResponse.ok) {
          const payment = await paymentResponse.json();
          if (payment.status === "APPROVED") {
            // Get order details
            const orderResponse = await fetch(`/api/orders/${orderId}`);
            if (orderResponse.ok) {
              const orderData = await orderResponse.json();
              setOrder(orderData);
            }
          }
        }
      } catch (error) {
        console.error("Error checking payment:", error);
        toast({
          title: "Error",
          description: "No se pudo verificar el estado del pago",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    checkPaymentStatus();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-warm flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg">Verificando pago...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-warm flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 mb-4">
            <CheckCircle className="h-16 w-16 mx-auto" />
          </div>
          <h1 className="text-2xl font-bold mb-4">Pago Pendiente</h1>
          <p className="text-gray-600 mb-6">
            Tu pago está siendo procesado. Te notificaremos cuando se complete.
          </p>
          <Link to="/">
            <Button>Volver al Inicio</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-warm py-12 px-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <div className="text-center mb-6">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">¡Pago Exitoso!</h1>
          <p className="text-gray-600 mt-2">Tu pedido ha sido confirmado</p>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex justify-between">
            <span className="font-medium">Pedido ID:</span>
            <span className="text-gray-600">{order.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Estado:</span>
            <span className="text-green-600 capitalize">{order.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Total:</span>
            <span className="font-bold">${order.total?.toLocaleString()}</span>
          </div>
        </div>

        <div className="text-center space-y-4">
          <Link to={`/order/${order.id}`}>
            <Button className="w-full">Ver Detalles del Pedido</Button>
          </Link>
          <Link to="/">
            <Button variant="outline" className="w-full">Volver al Inicio</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;