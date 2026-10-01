-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'friendly',
ADD COLUMN     "settledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cosmetics" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "equipped" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "rankedGames" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rankedSeason" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "rankedWins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rating" INTEGER NOT NULL DEFAULT 1000;

-- CreateTable
CREATE TABLE "RankedQueue" (
    "userId" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roomCode" TEXT,

    CONSTRAINT "RankedQueue_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "RankedMatch" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "playerAId" TEXT NOT NULL,
    "playerBId" TEXT NOT NULL,
    "nameA" TEXT NOT NULL,
    "nameB" TEXT NOT NULL,
    "scoreA" INTEGER NOT NULL,
    "scoreB" INTEGER NOT NULL,
    "ratingA" INTEGER NOT NULL,
    "ratingB" INTEGER NOT NULL,
    "deltaA" INTEGER NOT NULL,
    "deltaB" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankedMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankedSeasonResult" (
    "userId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "games" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "berrys" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankedSeasonResult_pkey" PRIMARY KEY ("userId","season")
);

-- CreateTable
CREATE TABLE "Raid" (
    "week" TEXT NOT NULL,
    "bossId" TEXT NOT NULL,
    "hp" INTEGER NOT NULL,
    "damage" INTEGER NOT NULL DEFAULT 0,
    "defeatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Raid_pkey" PRIMARY KEY ("week")
);

-- CreateTable
CREATE TABLE "RaidParticipant" (
    "week" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "damage" INTEGER NOT NULL DEFAULT 0,
    "attacks" INTEGER NOT NULL DEFAULT 0,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaidParticipant_pkey" PRIMARY KEY ("week","userId")
);

-- CreateTable
CREATE TABLE "RaidAttack" (
    "id" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "correct" INTEGER NOT NULL DEFAULT 0,
    "damage" INTEGER NOT NULL DEFAULT 0,
    "berrys" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RaidAttack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "golden" BOOLEAN NOT NULL DEFAULT false,
    "price" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "buyerId" TEXT,
    "proceeds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldAt" TIMESTAMP(3),
    "seenAt" TIMESTAMP(3),

    CONSTRAINT "MarketListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RankedQueue_lang_roomCode_lastSeenAt_idx" ON "RankedQueue"("lang", "roomCode", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "RankedMatch_roomId_key" ON "RankedMatch"("roomId");

-- CreateIndex
CREATE INDEX "RankedMatch_playerAId_createdAt_idx" ON "RankedMatch"("playerAId", "createdAt");

-- CreateIndex
CREATE INDEX "RankedMatch_playerBId_createdAt_idx" ON "RankedMatch"("playerBId", "createdAt");

-- CreateIndex
CREATE INDEX "RankedSeasonResult_season_rating_idx" ON "RankedSeasonResult"("season", "rating");

-- CreateIndex
CREATE INDEX "RaidParticipant_week_damage_idx" ON "RaidParticipant"("week", "damage");

-- CreateIndex
CREATE INDEX "RaidParticipant_userId_claimed_idx" ON "RaidParticipant"("userId", "claimed");

-- CreateIndex
CREATE INDEX "RaidAttack_userId_dayKey_idx" ON "RaidAttack"("userId", "dayKey");

-- CreateIndex
CREATE INDEX "MarketListing_status_createdAt_idx" ON "MarketListing"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MarketListing_sellerId_status_idx" ON "MarketListing"("sellerId", "status");

-- CreateIndex
CREATE INDEX "MarketListing_characterId_status_idx" ON "MarketListing"("characterId", "status");

-- CreateIndex
CREATE INDEX "User_rankedSeason_rating_idx" ON "User"("rankedSeason", "rating");

-- AddForeignKey
ALTER TABLE "RankedQueue" ADD CONSTRAINT "RankedQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankedSeasonResult" ADD CONSTRAINT "RankedSeasonResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidParticipant" ADD CONSTRAINT "RaidParticipant_week_fkey" FOREIGN KEY ("week") REFERENCES "Raid"("week") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidParticipant" ADD CONSTRAINT "RaidParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidAttack" ADD CONSTRAINT "RaidAttack_week_fkey" FOREIGN KEY ("week") REFERENCES "Raid"("week") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidAttack" ADD CONSTRAINT "RaidAttack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
