# TAUPOC Chile

Tienda en línea del distribuidor oficial de TAUPOC Swimwear en Chile: trajes de
competición homologados por World Aquatics, con inventario por talla y color.

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
| Correo | **Resend por API, con SMTP de respaldo** | La API va por HTTPS y evita el puerto 587, que varios proveedores bloquean. Sin proveedor configurado la tienda sigue vendiendo. |

Sin librería de gráficos: el gráfico de ventas del panel es SVG generado a mano,
para no cargar 100 kB extra de JavaScript en una pantalla interna.

---

## Puesta en marcha local

Requisitos: Node.js 22 y PostgreSQL 16.

```bash
npm install
cp .env.example .env          # completa DATABASE_URL y AUTH_SECRET
npx prisma migrate deploy     # crea la base y las tablas
npm run db:seed               # catálogo, envíos, cupones, blog y admin
npm run dev                   # http://localhost:3000
```

`migrate deploy` crea la base de datos si no existe, siempre que el usuario de la
conexión tenga permiso `CREATEDB`. Si tu Postgres te dio un usuario restringido,
créala antes con `createdb taupoc`. En Coolify no aplica: la imagen de Postgres ya
la crea a partir de `POSTGRES_DB`.

El seed carga el catálogo y el inventario del primer pedido: 4 productos, 306 SKU
y 48 unidades repartidas en 24 SKU (tallas 22 a 28, 2 unidades cada uno). Además
crea las tarifas de envío por zona, tres cupones y tres notas de blog, y genera
imágenes de producto provisionales con la identidad de marca mientras no haya
fotografía definitiva.

Es idempotente: puede volver a ejecutarse sin duplicar datos, y **no regenera las
imágenes de un producto que ya tiene alguna**, así que nunca pisa las fotografías
reales cargadas desde el panel.


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
   | `RESEND_API_KEY` | Clave de Resend. Es la vía recomendada: va por HTTPS. |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Alternativa por SMTP, si no usas la API. |
   | `MAIL_FROM` | Remitente, ej. `TAUPOC Chile <pedidos@taupoc.cl>`. |
   | `ADMIN_ALERT_EMAIL` | Destino de alertas de pedidos y stock bajo. |
   | `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Credenciales del admin inicial. |
   | `RUN_SEED` | `true` en el primer despliegue para cargar el catálogo. |
   | `FORCE_SEED` | `true` vuelve a sembrar aunque ya haya catálogo, pisando lo editado. |

   `NEXT_PUBLIC_SITE_URL` y `NEXT_PUBLIC_MP_PUBLIC_KEY` se incrustan en el bundle
   del navegador durante la compilación, así que deben estar definidas **antes**
   de construir la imagen. Si las cambias, hay que reconstruir, no solo reiniciar.

3. **Qué se guarda y dónde.** Dos volúmenes, y ninguno depende del seed:

   | Volumen | Qué guarda |
   | --- | --- |
   | `taupoc-db` | Base de datos: catálogo, stock, pedidos, blog, ajustes y **las fotos y videos que se suben desde el panel**. |
   | `taupoc-uploads` | Las imágenes de relleno que generó el seed la primera vez. |

   Apagar el seed no borra nada: solo evita que vuelva a escribir encima. Lo
   único que borra fotos es eliminar un volumen.

4. **Configura los volúmenes.** El compose ya declara los dos: `taupoc-db`
   para la base y `taupoc-uploads` montado en `/app/public/uploads` para las
   imágenes de relleno del seed. Sin este último, esas imágenes se pierden en
   cada despliegue y el catálogo queda con los huecos hasta que se reemplacen
   por fotos reales.

5. **Dominio y TLS.** Asigna el dominio en Coolify al servicio `app`; el proxy y
   el certificado los gestiona él. El contenedor escucha en el `3000` y no
   publica ningún puerto en el host: el proxy llega por la red interna de Docker.
   Publicarlo choca con las demás aplicaciones del servidor. Si alguna vez
   necesitas acceso directo desde el host, agrega un `ports` con un puerto libre.

6. **Primer arranque.** Deja `RUN_SEED=true` en el primer despliegue para cargar
   el catálogo. Con catálogo ya cargado el seed no hace nada, así que dejarlo
   puesto no borra lo que edites desde el panel; para volver a sembrar hay que
   pedirlo con `FORCE_SEED=true`. El entrypoint aplica las migraciones
   automáticamente en cada arranque, así que los despliegues siguientes no
   requieren pasos manuales.

7. **Secretos sin `$`.** Docker Compose interpreta el signo `$` de los valores
   como una variable. Si una contraseña generada lo incluye, el despliegue avisa
   `The "xxx" variable is not set` y usa un valor distinto del que definiste.
   Genera los secretos sin `$` o escríbelo duplicado (`$$`).

8. **Webhook de Mercado Pago.** En el panel de Mercado Pago registra la URL
   `https://tu-dominio.cl/api/webhooks/mercadopago` para el evento de pagos, y
   copia la firma secreta a `MP_WEBHOOK_SECRET`.

La sonda de salud está en `/api/health` y verifica también la conexión a la base.

### Si el despliegue falla

**`port is already allocated`** — otra aplicación del servidor ya usa ese puerto.
El compose no publica ninguno; si lo agregaste, quítalo o usa uno libre.

**`P1000: Authentication failed`** con `Skipping initialization` en el log de la
base — `POSTGRES_PASSWORD` solo se aplica cuando el volumen se crea por primera
vez. Si la cambiaste después, el rol conserva la contraseña anterior. Se
resuelve de dos formas:

```bash
# Opción A: empezar de cero. Con RUN_SEED=true el catálogo se vuelve a cargar.
docker volume rm <proyecto>_taupoc-db

# Opción B: conservar los datos y cambiar la contraseña del rol.
docker exec -it <contenedor-db> \
  psql -U taupoc -d taupoc -c "ALTER USER taupoc WITH PASSWORD 'la-nueva';"
```

Revisa además que el secreto no lleve un `$` sin escapar: Compose lo interpreta
como variable y guarda un valor distinto del que definiste, que es la causa más
frecuente de que la contraseña "correcta" no funcione.

La imagen se construye sin acceso a la base de datos: todas las páginas que leen
datos se renderizan en cada solicitud, lo que además garantiza que el stock que ve
el cliente sea siempre el real. El contenedor aplica sus propias migraciones al
arrancar, de modo que un despliegue nuevo no requiere ningún paso manual.

### Ambiente de pruebas de Mercado Pago

Con `MP_MODE=test` y credenciales `TEST-…` no se realizan cobros reales y el
checkout muestra un aviso visible. Usa las tarjetas de prueba de Mercado Pago
para simular pagos aprobados, pendientes y rechazados.

Para cobrar de verdad hacen falta tres cambios juntos, en el panel de Mercado
Pago → *Tus integraciones → Credenciales de producción*:

| Variable | Valor |
| --- | --- |
| `MP_MODE` | `live` |
| `MP_ACCESS_TOKEN` | El access token de producción (empieza con `APP_USR-`). |
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | La public key de producción (`APP_USR-`). |
| `MP_WEBHOOK_SECRET` | La firma del webhook de producción. |

`NEXT_PUBLIC_MP_PUBLIC_KEY` viaja al navegador y se incrusta al compilar, así
que hay que **reconstruir la imagen**, no solo reiniciar el contenedor. El
webhook de producción se registra aparte del de pruebas: son dos URLs iguales
pero con firmas distintas.

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

**Las fotos y videos del panel se guardan en la base de datos.** El contenedor
se reemplaza en cada despliegue, así que un archivo escrito en disco desaparece
salvo que haya un volumen montado. En la base entra además en el respaldo. Se
sirven desde `/api/media/<id>`: como el identificador se genera al subir y no se
reutiliza, la dirección nunca cambia de contenido y se cachea para siempre —y
por eso reemplazar el logo se ve al instante, sin caché vieja de por medio.

**Las imágenes se optimizan; los videos no se recodifican.** De cada imagen se
generan versiones en AVIF y WEBP en cinco anchos, en segundo plano y guardadas
aparte: el original nunca se toca y, si algo falla, se sirve tal cual. Un video
se valida (formato, códec, índice al inicio, peso) y se sirve por tramos, pero
se descarga como se subió: recodificarlo necesitaría ffmpeg en la imagen. Por
eso el panel avisa cuando un video pasa de 8 MB o viene en H.265.

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
- **Inicio** — bloques que arman la portada en el orden que se quiera: banners
  de una o varias láminas —fotos y videos mezclados, pasando solos—, franjas de
  productos elegidos a mano, tarjetas de acceso, bloques de texto. Cada bloque se sube, se baja, se duplica, se oculta o se
  borra. Las fotos y los videos se suben arrastrándolos o pegando una dirección.
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
- **Ajustes** — logo, identidad, umbral de envío gratis, cuotas, barra de anuncio,
  portada, Google Analytics, Google Tag Manager, Meta Pixel y notificaciones.
- **Exportación a CSV** en pedidos, productos, inventario, clientes,
  cotizaciones y ventas, con separador y codificación compatibles con Excel en
  español.

---

## Correos transaccionales

Se envían automáticamente al cliente: pedido recibido, pago confirmado y pedido
despachado con número de seguimiento. Al equipo: pedido pagado, alerta de stock
bajo (máximo una vez cada 12 horas) y nueva cotización de club.

El transporte se elige en este orden:

1. **Resend por API** si existe `RESEND_API_KEY`.
2. **SMTP** si existe `SMTP_HOST`. Resend también funciona por esta vía: host
   `smtp.resend.com`, usuario `resend`, contraseña la API key.
3. **Log del servidor** si no hay ninguno configurado. La tienda sigue vendiendo:
   el correo nunca bloquea una venta.

El dominio de `MAIL_FROM` tiene que estar verificado en Resend (Domains → Add
Domain, y cargar los registros DNS). Sin eso el envío falla con 403 y el motivo
queda registrado en el log. El panel muestra en *Ajustes* qué transporte está
activo.

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
