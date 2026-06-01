export const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://fasty-delta.vercel.app").replace(/\/$/, "");
export const SITE_NAME = "Fasty";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/pwa-512x512.png`;

export type SeoConfig = {
  title: string;
  description: string;
  index?: boolean;
  path?: string;
};

const DEFAULT_SEO: SeoConfig = {
  title: "Fasty — Domicilios en Quibdó | Envíos rápidos y seguros",
  description:
    "Pide domicilios en Quibdó con Fasty. Restaurantes, tiendas locales y entregas rápidas a tu puerta.",
  index: true,
};

const ROUTE_SEO: Record<string, SeoConfig> = {
  "/": {
    title: "Fasty — Domicilios en Quibdó | Envíos rápidos y seguros",
    description:
      "Domicilios rápidos en Quibdó. Pide a restaurantes y tiendas locales con entrega confiable.",
    index: true,
  },
  "/negocios": {
    title: "Negocios en Quibdó | Fasty",
    description: "Explora restaurantes y tiendas con domicilio en Quibdó. Pide online con Fasty.",
    index: true,
  },
  "/pedido-abierto": {
    title: "Encargo abierto | Fasty Quibdó",
    description: "Pide lo que necesites con encargo abierto. Domiciliarios de Fasty lo recogen y te lo llevan.",
    index: true,
  },
  "/viajes": {
    title: "Viajes compartidos en Quibdó | Fasty",
    description: "Viaja seguro en Quibdó con conductores verificados de Fasty.",
    index: true,
  },
  "/negocios/registro": {
    title: "Registra tu negocio | Fasty Quibdó",
    description: "Únete a Fasty y recibe pedidos a domicilio en Quibdó.",
    index: true,
  },
  "/conductor/registro": {
    title: "Regístrate como conductor | Fasty",
    description: "Conduce con Fasty en Quibdó. Registro de conductores y domiciliarios.",
    index: true,
  },
  "/soporte": {
    title: "Soporte | Fasty",
    description: "Centro de ayuda y contacto de Fasty Quibdó.",
    index: true,
  },
  "/politica-de-privacidad": {
    title: "Política de privacidad | Fasty",
    description: "Política de privacidad y tratamiento de datos de Fasty.",
    index: true,
  },
  "/terminos-y-condiciones": {
    title: "Términos y condiciones | Fasty",
    description: "Términos y condiciones de uso de la plataforma Fasty.",
    index: true,
  },
  "/login": {
    title: "Iniciar sesión | Fasty",
    description: "Accede a tu cuenta Fasty.",
    index: false,
  },
  "/checkout": {
    title: "Checkout | Fasty",
    description: "Finaliza tu pedido en Fasty.",
    index: false,
  },
  "/perfil": {
    title: "Mi perfil | Fasty",
    description: "Tu perfil de cliente en Fasty.",
    index: false,
  },
  "/rastreo": {
    title: "Rastreo de pedido | Fasty",
    description: "Sigue tu pedido en tiempo real con Fasty.",
    index: false,
  },
};

const NOINDEX_PREFIXES = [
  "/admin",
  "/domiciliario",
  "/negocio",
  "/conductor/viajes",
  "/rastreo/",
  "/viajes/seguir/",
  "/payment/",
];

export function getSeoForPath(pathname: string): SeoConfig {
  if (ROUTE_SEO[pathname]) {
    return { ...ROUTE_SEO[pathname], path: pathname };
  }

  const businessMatch = pathname.match(/^\/negocios\/([^/]+)$/);
  if (businessMatch && businessMatch[1] !== "registro") {
    return {
      title: "Negocio en Quibdó | Fasty",
      description: "Menú, productos y domicilio disponible en Fasty Quibdó.",
      index: true,
      path: pathname,
    };
  }

  if (NOINDEX_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return {
      title: "Fasty",
      description: DEFAULT_SEO.description,
      index: false,
      path: pathname,
    };
  }

  return { ...DEFAULT_SEO, path: pathname };
}

export function absoluteUrl(path = "/"): string {
  if (path.startsWith("http")) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
