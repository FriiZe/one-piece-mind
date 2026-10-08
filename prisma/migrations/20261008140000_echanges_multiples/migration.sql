-- CreateTable
CREATE TABLE "TradeItem" (
    "tradeId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "golden" BOOLEAN NOT NULL DEFAULT false,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TradeItem_pkey" PRIMARY KEY ("tradeId","side","characterId","golden")
);

-- AddForeignKey
ALTER TABLE "TradeItem" ADD CONSTRAINT "TradeItem_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Chaque échange existant devient un avis contre un avis
INSERT INTO "TradeItem" ("tradeId", "side", "characterId", "golden", "count")
SELECT "id", 'offered', "offeredId", "offeredGolden", 1 FROM "Trade";

INSERT INTO "TradeItem" ("tradeId", "side", "characterId", "golden", "count")
SELECT "id", 'requested', "requestedId", "requestedGolden", 1 FROM "Trade";

-- AlterTable
ALTER TABLE "Trade" DROP COLUMN "offeredGolden",
DROP COLUMN "offeredId",
DROP COLUMN "requestedGolden",
DROP COLUMN "requestedId";
