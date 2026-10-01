import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Mots de passe : scrypt avec un sel par compte. Paramètres recommandés par
 * l'OWASP (N = 2^15, r = 8, p = 3), soit environ 32 Mo de mémoire par calcul.
 */
const PARAMS = { N: 2 ** 15, r: 8, p: 3 };
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, params = PARAMS): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { ...params, maxmem: 256 * params.N * params.r }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

/** Empreinte au format `scrypt$N$r$p$sel$clé` : les paramètres voyagent avec elle. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"), { N: Number(N), r: Number(r), p: Number(p) });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Empreinte factice, pour que la connexion prenne le même temps quand le pseudo n'existe pas. */
export const DUMMY_HASH = `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(KEY_LENGTH).toString("base64")}`;
