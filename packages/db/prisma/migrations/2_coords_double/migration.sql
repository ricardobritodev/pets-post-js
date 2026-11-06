-- M-01 (specs/data/migration-plan.md): coordenadas de FLOAT (~7 dígitos) para DOUBLE.
-- FLOAT arredondava a ~1 m e às vezes mais; DOUBLE guarda o que o Nominatim devolve.
-- O Flask continua lendo (o SQLAlchemy Float aceita DOUBLE), então o rollback segue possível.

-- AlterTable
ALTER TABLE `pet_posts` MODIFY `last_seen_lat` DOUBLE NULL,
    MODIFY `last_seen_lng` DOUBLE NULL;

-- AlterTable
ALTER TABLE `adoption_posts` MODIFY `location_lat` DOUBLE NULL,
    MODIFY `location_lng` DOUBLE NULL;

-- AlterTable
ALTER TABLE `partners` MODIFY `lat` DOUBLE NULL,
    MODIFY `lng` DOUBLE NULL;

