import React, { useEffect, useState } from 'react';
import { LoadScript } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

interface WompiCheckoutProps {
  reference: string;
  amount: number;
  currency: string;
  publicKey: string;
  onSuccess?: (transactionId: string) => void;
  onError?: (error: any) => void;
  email?: string;
}

declare global {
  interface Window {
    WidgetCheckout?: any;
  }
}

export const WompiCheckout: React.FC<WompiCheckoutProps> = ({
  reference,
  amount,
  currency,
  publicKey,
  onSuccess,
  onError,
  email
}) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load Wompi script
    const script = document.createElement('script');
    script.src = 'https://checkout.wompi.co/widget.js';
    script.async = true;
    script.onload = () => {
      setLoading(false);
      initializeCheckout();
    };
    script.onerror = () => {
      setLoading(false);
      console.error('Error loading Wompi widget');
      toast({
        title: "Error",
        description: "No se pudo cargar el widget de pago",
        variant: "destructive"
      });
    };
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  const initializeCheckout = () => {
    if (typeof window.WidgetCheckout !== 'undefined') {
      const checkout = new window.WidgetCheckout({
        currency,
        amountInCents: amount * 100,
        reference,
        publicKey,
        redirectUrl: `${window.location.origin}/payment/success?order_id=${reference}`,
      });

      checkout.on('close', () => {
        toast({
          title: "Pago cancelado",
          description: "Has cerrado el formulario de pago.",
          variant: "destructive"
        });
        if (onError) {
          onError(new Error('Payment cancelled'));
        }
      });

      checkout.on('success', (transaction: any) => {
        if (onSuccess) {
          onSuccess(transaction.id);
        }
      });

      checkout.on('error', (error: any) => {
        if (onError) {
          onError(error);
        }
      });

      checkout.render('#wompi-checkout');
    }
  };

  if (loading) {
    return (
      <Card className="p-6 text-center">
        <p>Cargando formulario de pago...</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div id="wompi-checkout" />
    </Card>
  );
};

export default WompiCheckout;