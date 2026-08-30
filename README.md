# TAUPOC Chile

Tienda en línea del distribuidor oficial de TAUPOC Swimwear en Chile: trajes de
competición homologados por World Aquatics, con stock real por talla y color.

Incluye tienda pública, checkout con Mercado Pago, cálculo de envíos configurable
y un panel de administración completo en español, pensado para operarse sin
conocimientos técnicos.

---

## Stack y por qué

| Pieza | Elección | Razón |
| --- | --- | --- |
| Framework | **Next.js 15** (App Router) | Un solo servicio sirve la tienda, la API y el panel: un contenedor, un despliegue en Coolify. SSR e ISR nativos para el SEO de fichas y blog. |
| Lenguaje | **TypeScript** | El modelo variante × talla × color es propenso a errores silenciosos; los tipos los atrapan en compilación. |
| Base de datos | **PostgreSQL + Prisma** | Stock por SKU, cupones y pedidos necesitan integridad referencial y transacciones. Prisma da migraciones versionadas y consultas tipadas. |
| Estilos | **Tailwind CSS** | Sistema de diseño propio con tokens, sin arrastrar una librería de componentes ajena a la identidad de la marca. |
| Pagos | **Mercado Pago Checkout Pro** | Es el estándar en Chile: crédito, débito y cuotas sin implementar PCI. |
| Autenticación | **JWT propio + bcrypt** | Sin dependencias en beta; control total de los roles cliente / equipo / administrador. |
| Imágenes | **sharp + volumen local** | Conversión a WEBP al subir. Sin depender de S3 ni de un servicio externo. |
| Correo | **Nodemailer sobre SMTP** | Compatible con cualquier proveedor. Si no hay SMTP, la tienda sigue vendiendo. |

Sin librería de gráficos: el gráfico de ventas del panel es SVG generado a mano,
para no cargar 100 kB extra de JavaScript en una pantalla interna.

---

## Puesta en marcha local

Requisitos: Node.js 22 y PostgreSQL 16.

```bash
npm install
cp .env.example .env          # completa DATABASE_URL y AUTH_SECRET
npx prisma migrate deploy     # crea el esquema
npm run db:seed               # catálogo, envíos, cupones, blog y admin
npm run dev                   # http://localhost:3000
```

El seed crea el catálogo inicial completo: 4 productos, 306 SKU, tarifas de envío
por zona geográfica de Chile, tres cupones de ejemplo y tres notas de blog. También
genera imágenes de producto provisionales con la identidad de marca, para que la
tienda nunca se vea rota antes de cargar la fotografía real.

Es idempotente: puede volver a ejecutarse sin duplicar datos, y **no regenera las
imágenes de un producto que ya tiene alguna**, así que nunca pisa las fotografías
reales cargadas desde el panel.

**Acceso al panel:** `/admin/ingresar`
Usuario y clave por defecto: `admin@taupoc.cl` / `taupoc2024`
(configurables con `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`).
Cámbiala en el primer ingreso desde *Mi cuenta → Contraseña*.

### Comandos

```bash
npm run dev          # desarrollo
npm run build        # compilación de producción
npm run start        # servidor de producción
npm run typecheck    # verificación de tipos
npm run db:migrate   # aplicar migraciones
npm run db:seed      # poblar datos iniciales
npm run db:studio    # explorador visual de la base
```

---

## Despliegue en Coolify

1. **Crea el recurso.** En tu proyecto de Coolify, agrega un recurso de tipo
   *Docker Compose* apuntando a este repositorio. Coolify detecta
   `docker-compose.yml` y levanta la aplicación junto a su PostgreSQL.

2. **Define las variables de entorno** en el panel de Coolify:

   | Variable | Descripción |
   | --- | --- |
   | `POSTGRES_PASSWORD` | Contraseña de la base de datos. |
   | `AUTH_SECRET` | Secreto de sesión. Genera uno con `openssl rand -base64 48`. |
   | `NEXT_PUBLIC_SITE_URL` | URL pública, ej. `https://taupoc.cl`. Sin barra final. |
   | `MP_MODE` | `test` o `live`. |
   | `MP_ACCESS_TOKEN` | Access token de Mercado Pago. |
   | `NEXT_PUBLIC_MP_PUBLIC_KEY` | Public key de Mercado Pago. |
   | `MP_WEBHOOK_SECRET` | Firma secreta del webhook (panel de MP → Webhooks). |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Servidor de correo saliente. |
   | `MAIL_FROM` | Remitente, ej. `TAUPOC Chile <pedidos@taupoc.cl>`. |
   | `ADMIN_ALERT_EMAIL` | Destino de alertas de pedidos y stock bajo. |
   | `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Credenciales del admin inicial. |
   | `RUN_SEED` | `true` solo en el primer despliegue. |

   `NEXT_PUBLIC_SITE_URL` y `NEXT_PUBLIC_MP_PUBLIC_KEY` se incrustan en el bundle
   del navegador durante la compilación, así que deben estar definidas **antes**
   de construir la imagen. Si las cambias, hay que reconstruir, no solo reiniciar.

3. **Configura el volumen persistente.** El compose ya declara
   `taupoc-uploads` montado en `/app/public/uploads`. Ahí viven las fotos de
   producto que se suben desde el panel: sin ese volumen se pierden en cada
   despliegue.

4. **Dominio y TLS.** Asigna el dominio en Coolify; el proxy y el certificado
   los gestiona él. La aplicación escucha en el puerto `3000`.

5. **Primer arranque.** Deja `RUN_SEED=true` en el primer despliegue y ponlo en
   `false` después. El entrypoint aplica las migraciones automáticamente en cada
   arranque, así que los despliegues siguientes no requieren pasos manuales.

6. **Webhook de Mercado Pago.** En el panel de Mercado Pago registra la URL
   `https://tu-dominio.cl/api/webhooks/mercadopago` para el evento de pagos, y
   copia la firma secreta a `MP_WEBHOOK_SECRET`.

La sonda de salud está en `/api/health` y verifica también la conexión a la base.

La imagen se construye sin acceso a la base de datos: todas las páginas que leen
datos se renderizan en cada solicitud, lo que además garantiza que el stock que ve
el cliente sea siempre el real. El contenedor aplica sus propias migraciones al
arrancar, de modo que un despliegue nuevo no requiere ningún paso manual.

### Ambiente de pruebas de Mercado Pago

Con `MP_MODE=test` y credenciales `TEST-…` no se realizan cobros reales y el
checkout muestra un aviso visible. Usa las tarjetas de prueba de Mercado Pago
para simular pagos aprobados, pendientes y rechazados.

---

## Arquitectura

```
src/
  app/
    (store)/            Tienda pública: home, catálogo, ficha, carrito,
                        checkout, cuenta, marca, clubes, blog, ayuda
    admin/              Panel de administración
    api/
      webhooks/         Webhook de Mercado Pago
      admin/export/     Exportación a CSV
      health/           Sonda de salud
  actions/              Server actions (carrito, checkout, cuenta, panel)
  components/
    ui/                 Primitivas del sistema de diseño
    store/              Componentes de la tienda
    admin/              Componentes del panel
  lib/                  Dominio: catálogo, carrito, precios, envíos,
                        inventario, pedidos, Mercado Pago, correo, SEO
prisma/
  schema.prisma         Modelo de datos
  seed.ts               Datos iniciales
  migrations/           Migraciones versionadas
```

### Decisiones que conviene conocer

**El dinero es entero.** El peso chileno no usa decimales: todos los montos se
guardan y calculan como enteros. `formatCLP()` los presenta como `$139.900`.

**El stock se descuenta cuando el pago se acredita, no al hacer checkout.** Un
carrito abandonado nunca bloquea inventario. Lo hace el webhook de Mercado Pago,
que además es idempotente: la misma notificación puede llegar varias veces.

**El costo de envío se recalcula en el servidor.** El cliente elige una opción,
pero `resolveShippingOption()` vuelve a calcular el precio antes de crear el
pedido. Nunca se confía en lo que llega del navegador.

**Los pedidos guardan una copia de los datos.** Nombre de producto, color, talla,
SKU y precio quedan congelados en `OrderItem`. Si mañana cambia el catálogo, el
historial de ventas no se altera.

**Un producto con ventas no se borra: se archiva.** Lo mismo con los cupones ya
usados. El historial tiene que seguir siendo legible.

**Todo el inventario deja rastro.** Cada cambio de stock genera un
`InventoryMovement` con el motivo y quién lo hizo. Es lo que permite cuadrar lo
vendido en el stand del torneo con lo vendido online.

**Las tarifas de envío viven en la base de datos.** El admin crea zonas, couriers
y reglas por peso o por monto sin tocar código ni volver a desplegar.

---

## Panel de administración

- **Resumen** — ventas del día, semana y mes, gráfico de 30 días, pedidos por
  preparar y SKU bajo el umbral de stock.
- **Pedidos** — filtros, detalle, cambio de estado con sincronía de inventario,
  carga de seguimiento con aviso automático al cliente, notas internas,
  reembolsos y packing slip imprimible.
- **Productos** — alta, edición, duplicado y archivado; **matriz visual de stock
  talla × color** editable como planilla, con relleno por fila y por columna;
  carga de imágenes con drag & drop y asignación por color; tabla de tallas y
  ficha técnica editables.
- **Inventario** — ajuste rápido de cualquier SKU, filtros por agotado y stock bajo.
- **Clientes** — historial de compras, talla habitual, gestión de permisos.
- **Envíos** — zonas por región, tarifas por courier, precio fijo o por peso o
  monto, envío gratis por umbral, retiro en tienda y entrega en torneo.
- **Cupones** — porcentaje, monto fijo o envío gratis, con límites por monto
  mínimo, fechas, usos totales, usos por cliente y productos específicos.
- **Cotizaciones** — solicitudes de clubes con seguimiento de estado.
- **Blog** — editor markdown con portada, etiquetas y campos SEO.
- **Reportes** — ingresos, productos, tallas y colores más vendidos, ventas por
  región y uso de cupones, por período.
- **Ajustes** — identidad, umbral de envío gratis, cuotas, barra de anuncio,
  portada, Google Analytics, Google Tag Manager, Meta Pixel y notificaciones.
- **Exportación a CSV** en pedidos, productos, inventario, clientes,
  cotizaciones y ventas, con separador y codificación compatibles con Excel en
  español.

---

## Correos transaccionales

Se envían automáticamente al cliente: pedido recibido, pago confirmado y pedido
despachado con número de seguimiento. Al equipo: pedido pagado, alerta de stock
bajo (máximo una vez cada 12 horas) y nueva cotización de club.

Si no hay SMTP configurado, los mensajes se registran en el log del servidor y la
tienda sigue funcionando: el correo nunca bloquea una venta.

---

## SEO

Metadatos y Open Graph por página, sitemap dinámico que incluye productos y notas,
`robots.txt` que excluye panel, carrito y checkout, y datos estructurados de
schema.org: `Product` con `AggregateOffer` y el código de homologación, `Article`,
`FAQPage`, `HowTo`, `BreadcrumbList` e `ItemList`.

Las combinaciones de filtros del catálogo se marcan `noindex` para no generar
contenido duplicado.

---

## Accesibilidad y rendimiento

Navegación completa por teclado, foco visible, etiquetas ARIA en controles
interactivos, regiones `aria-live` en el selector de talla y el carrito, y
respeto por `prefers-reduced-motion`.

Las imágenes se sirven en AVIF y WEBP mediante `next/image` con tamaños
responsivos. Los scripts de analítica se cargan después de la interacción.
