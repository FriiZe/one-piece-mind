-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "offeredGolden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requestedGolden" BOOLEAN NOT NULL DEFAULT false;

-- Une proposition en attente portait sur l'exemplaire doré quand son propriétaire n'en avait pas d'ordinaire
UPDATE "Trade" t SET "offeredGolden" = true
FROM "CollectionEntry" c
WHERE t."status" = 'pending' AND c."userId" = t."fromId" AND c."characterId" = t."offeredId" AND c."count" - c."golden" <= 0;

UPDATE "Trade" t SET "requestedGolden" = true
FROM "CollectionEntry" c
WHERE t."status" = 'pending' AND c."userId" = t."toId" AND c."characterId" = t."requestedId" AND c."count" - c."golden" <= 0;
