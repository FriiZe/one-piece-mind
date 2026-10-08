-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "seenAt" TIMESTAMP(3);

-- Une proposition annulée par son auteur n'a rien de neuf à lui apprendre
UPDATE "Trade" SET "seenAt" = "answeredAt" WHERE "status" = 'cancelled';
