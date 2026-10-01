import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/** Sans base de données configurée, le site fonctionne en mode invité uniquement. */
export const accountsEnabled = !!process.env.DATABASE_URL;

// En développement, le rechargement à chaud réévalue ce module : on garde le
// client sur `globalThis` pour ne pas ouvrir un groupe de connexions à chaque fois.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function db(): PrismaClient {
  if (!accountsEnabled) throw new Error("Base de données non configurée (DATABASE_URL)");
  globalForPrisma.prisma ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  return globalForPrisma.prisma;
}
