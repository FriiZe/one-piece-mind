-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'fr';

-- CreateTable
CREATE TABLE "QuizThumbnail" (
    "quizId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "QuizThumbnail_pkey" PRIMARY KEY ("quizId")
);

-- AddForeignKey
ALTER TABLE "QuizThumbnail" ADD CONSTRAINT "QuizThumbnail_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
