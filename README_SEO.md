SEO Quick Actions (aplicar y personalizar)

1) Reemplazar placeholders en `index.html`:
   - `https://YOUR_DOMAIN/` -> tu dominio (ej: https://fasty.com)
   - `+57-YOUR_PHONE_NUMBER` -> teléfono oficial en formato internacional
   - Actualizar `sameAs` en JSON-LD con URLs de redes sociales si aplica

2) Subir `sitemap.xml` y `robots.txt` al root de tu sitio y verificar:
   - `https://YOUR_DOMAIN/sitemap.xml`
   - `https://YOUR_DOMAIN/robots.txt`
   - Registrar y enviar el sitemap en Google Search Console.

3) Mejoras adicionales recomendadas:
   - Hacer prerender/SSR de la página principal para mejor indexación (Vercel prerender, prerender.io o Next.js).
   - Añadir etiquetas OpenGraph específicas por ruta (e.g., páginas de negocio) y meta `title`/`description` dinámicos.
   - Generar `sitemap.xml` dinámico que incluya todas las páginas de negocios y productos (script backend para generar sitemap automáticamente).
   - Implementar hreflang si soportas otros idiomas.

4) Comprobaciones después de publicar:
   - Usar la herramienta de inspección de URL de Google Search Console.
   - Probar el JSON-LD en el Rich Results Test (https://search.google.com/test/rich-results).
   - Ejecutar Lighthouse (SEO) y corregir avisos.

Si quieres, puedo:
- Reemplazar `YOUR_DOMAIN` y `YOUR_PHONE_NUMBER` si me das los valores.
- Generar un script Python para crear un sitemap dinámico desde la base de datos.
- Añadir prerender configuration para Vercel / Next.js.
