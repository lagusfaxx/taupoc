-- Tamaño del título del banner de taupoc.lat (S, M o L). Columna nueva con valor por defecto.
ALTER TABLE "IntlBanner" ADD COLUMN "titleSize" TEXT NOT NULL DEFAULT 'M';
