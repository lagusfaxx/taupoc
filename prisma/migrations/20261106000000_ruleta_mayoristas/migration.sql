-- Cotizaciones de tiendas mayoristas además de clubes.
CREATE TYPE "QuoteKind" AS ENUM ('CLUB', 'STORE');

ALTER TABLE "QuoteRequest"
    ADD COLUMN "kind" "QuoteKind" NOT NULL DEFAULT 'CLUB',
    ADD COLUMN "storefront" TEXT NOT NULL DEFAULT 'CL',
    ADD COLUMN "taxId" TEXT,
    ADD COLUMN "storeUrl" TEXT,
    ADD COLUMN "country" TEXT;

CREATE INDEX "QuoteRequest_kind_idx" ON "QuoteRequest"("kind");

-- Ruleta de descuento: un giro por correo.
CREATE TABLE "RouletteSpin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "prize" TEXT NOT NULL,
    "couponCode" TEXT NOT NULL,
    "storefront" TEXT NOT NULL DEFAULT 'CL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouletteSpin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RouletteSpin_email_key" ON "RouletteSpin"("email");
CREATE INDEX "RouletteSpin_createdAt_idx" ON "RouletteSpin"("createdAt");

-- La talla de la tabla es la que se compra: fuera la recomendación de bajar
-- una o dos tallas, que llevó a cambios. Solo se tocan los textos de la carga
-- inicial; lo que se haya reescrito desde el panel queda igual.
UPDATE "Product"
SET "fitNotes" = 'Elige la talla que indica la tabla según tu cintura. El jammer queda ajustado y cuesta subirlo por los muslos: es normal en un traje de compresión.'
WHERE "gender" = 'MALE' AND "fitNotes" ILIKE '%baja 1 a 2 tallas%';

UPDATE "Product"
SET "fitNotes" = 'Elige la talla que indica la tabla según tu pecho, cintura y cadera. El knee suit queda ajustado: póntelo con las manos abiertas, nunca tirando con las uñas.'
WHERE "gender" = 'FEMALE' AND "fitNotes" ILIKE '%baja 1 a 2 tallas%';

UPDATE "Product" SET "fitOffset" = 0;
ALTER TABLE "Product" ALTER COLUMN "fitOffset" SET DEFAULT 0;

UPDATE "Post"
SET
  "body" = regexp_replace(
    replace(
      replace(
        "body",
        'Un traje de carrera funciona por compresión. Si entra cómodo, no está haciendo su trabajo. Esa es la razón por la que un nadador que usa talla 32 en entrenamiento compite en 28 o 30.',
        'Un traje de carrera funciona por compresión, así que queda más ajustado que uno de entrenamiento. Por eso la talla se elige con medidas, no con la talla de ropa.'
      ),
      'obtienes tu **talla de cuerpo**.',
      'obtienes tu **talla**.'
    ),
    '## Y ahora baja una o dos tallas.*?(## Cómo ponerse el traje)',
    E'## Busca tu fila en la tabla\n\nLa talla de la tabla es la que compras. Si tus medidas quedan entre dos tallas, escríbenos antes de comprar y te confirmamos.\n\nEl traje va a quedar ajustado y ponérselo toma unos minutos: es normal en un traje de compresión.\n\n\\1'
  ),
  "excerpt" = 'Cómo medirse para elegir la talla de un traje de competición, cómo ponérselo sin romperlo y cuánto dura.',
  "seoDescription" = 'Cómo medirse para elegir la talla de un traje de competición, cómo ponérselo sin romperlo y cuánto dura.'
WHERE "slug" = 'como-elegir-la-talla-de-tu-traje-de-competicion'
  AND "body" LIKE '%## Y ahora baja una o dos tallas%';
