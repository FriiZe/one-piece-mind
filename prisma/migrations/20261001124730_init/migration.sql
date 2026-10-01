-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "usernameKey" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "berrys" INTEGER NOT NULL DEFAULT 0,
    "lifetimeBerrys" INTEGER NOT NULL DEFAULT 0,
    "games" INTEGER NOT NULL DEFAULT 0,
    "dayKey" TEXT NOT NULL DEFAULT '',
    "dayEarned" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionEntry" (
    "userId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "golden" INTEGER NOT NULL DEFAULT 0,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionEntry_pkey" PRIMARY KEY ("userId","characterId")
);

-- CreateTable
CREATE TABLE "CrewSlot" (
    "userId" TEXT NOT NULL,
    "post" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,

    CONSTRAINT "CrewSlot_pkey" PRIMARY KEY ("userId","post")
);

-- CreateTable
CREATE TABLE "GameResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "reportKey" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "difficulty" TEXT,
    "score" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "berrys" INTEGER NOT NULL,
    "recruitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthThrottle" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthThrottle_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_usernameKey_key" ON "User"("usernameKey");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "GameResult_userId_createdAt_idx" ON "GameResult"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameResult_userId_slug_reportKey_key" ON "GameResult"("userId", "slug", "reportKey");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionEntry" ADD CONSTRAINT "CollectionEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewSlot" ADD CONSTRAINT "CrewSlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
