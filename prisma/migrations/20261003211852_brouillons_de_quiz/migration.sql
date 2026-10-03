-- CreateTable
CREATE TABLE "QuizDraft" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuizDraft_authorId_updatedAt_idx" ON "QuizDraft"("authorId", "updatedAt");

-- AddForeignKey
ALTER TABLE "QuizDraft" ADD CONSTRAINT "QuizDraft_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
