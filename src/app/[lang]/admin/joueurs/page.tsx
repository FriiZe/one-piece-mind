import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminHeader, pill, TABLE } from "@/components/admin/AdminUi";
import Link from "@/components/Link";
import { formatNumber } from "@/games/engine/text";
import { formatAgo, formatDate } from "@/lib/admin/format";
import { playerBounty } from "@/lib/economy";
import { localePath } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n/server";
import { ADMIN_USER_SORTS, adminUsers, type AdminUserSort } from "@/lib/server/admin";
import { currentUser } from "@/lib/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Joueurs — Administration", "Players — Administration"), robots: { index: false, follow: false } };
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function AdminPlayersPage({ searchParams }: PageProps<"/[lang]/admin/joueurs">) {
  const params = await searchParams;
  const query = first(params.q).trim().slice(0, 40);
  const sort = ADMIN_USER_SORTS.find((id) => id === first(params.tri)) ?? "recent";
  // Pour tout autre visiteur qu'un administrateur, cette page n'existe pas
  const list = await adminUsers(await currentUser(), { query, sort, page: Number(first(params.page)) || 1 });
  if (!list) notFound();

  const locale = await getLocale();
  const t = await getT();
  const number = (value: number) => formatNumber(value, locale);
  const sorts: Record<AdminUserSort, string> = {
    recent: t("Inscription", "Sign-up"),
    seen: t("Dernière visite", "Last visit"),
    games: t("Parties", "Games"),
    bounty: t("Prime", "Bounty"),
    berrys: t("Berrys", "Berries"),
  };
  /** Adresse de la liste avec la recherche en cours ; les valeurs par défaut n'y figurent pas. */
  const href = (next: { sort?: AdminUserSort; page?: number }) => {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if ((next.sort ?? sort) !== "recent") search.set("tri", next.sort ?? sort);
    if (next.page && next.page > 1) search.set("page", String(next.page));
    return `/admin/joueurs${search.size ? `?${search}` : ""}`;
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-7 sm:py-8">
      <AdminHeader current="players" />
      <h1 className="sr-only">{t("Joueurs", "Players")}</h1>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <form action={localePath(locale, "/admin/joueurs")} role="search" className="flex gap-2">
          {sort !== "recent" && <input type="hidden" name="tri" value={sort} />}
          <input
            type="search"
            name="q"
            defaultValue={query}
            maxLength={40}
            placeholder={t("Chercher un pseudo", "Search a username")}
            aria-label={t("Chercher un pseudo", "Search a username")}
            className="w-56 rounded-full border border-sea-600 bg-sea-900 px-4 py-1.5 text-foam placeholder:text-mist"
          />
          <button type="submit" className="rounded-full bg-straw px-4 py-1.5 text-sm font-bold text-ink hover:bg-straw-dark">
            {t("Chercher", "Search")}
          </button>
        </form>
        <nav aria-label={t("Trier par", "Sort by")} className="flex flex-wrap items-center gap-2 text-sm font-bold">
          <span className="text-mist">{t("Trier par", "Sort by")}</span>
          {ADMIN_USER_SORTS.map((id) => (
            <Link key={id} href={href({ sort: id })} aria-current={id === sort ? "true" : undefined} className={pill(id === sort)}>
              {sorts[id]}
            </Link>
          ))}
        </nav>
      </div>

      <p className="text-sm text-mist" role="status">
        {query
          ? t(
              `${number(list.total)} compte${list.total > 1 ? "s" : ""} pour « ${query} »`,
              `${number(list.total)} ${list.total === 1 ? "account" : "accounts"} matching “${query}”`,
            )
          : t(`${number(list.total)} compte${list.total > 1 ? "s" : ""}`, `${number(list.total)} ${list.total === 1 ? "account" : "accounts"}`)}
        {query && (
          <>
            {" · "}
            <Link href={sort === "recent" ? "/admin/joueurs" : `/admin/joueurs?tri=${sort}`} className="font-bold text-straw underline underline-offset-4">
              {t("Tout afficher", "Show all")}
            </Link>
          </>
        )}
      </p>

      {list.rows.length > 0 && (
        <div className={TABLE.wrapper}>
          <table className={TABLE.table}>
            <thead className={TABLE.head}>
              <tr>
                <th scope="col">{t("Pseudo", "Username")}</th>
                <th scope="col">{t("Inscrit le", "Signed up")}</th>
                <th scope="col">{t("Dernière visite", "Last visit")}</th>
                <th scope="col" className={TABLE.number}>
                  {t("Parties", "Games")}
                </th>
                <th scope="col" className={TABLE.number}>
                  {t("Prime", "Bounty")}
                </th>
                <th scope="col" className={TABLE.number}>
                  {t("Berrys", "Berries")}
                </th>
                <th scope="col" className={TABLE.number}>
                  {t("Avis", "Posters")}
                </th>
              </tr>
            </thead>
            <tbody className={TABLE.body}>
              {list.rows.map((player) => (
                <tr key={player.id}>
                  <td>
                    <Link href={`/admin/joueurs/${player.id}`} className="font-bold text-foam hover:text-straw">
                      {player.username}
                    </Link>
                  </td>
                  <td className="text-mist">{formatDate(player.createdAt, locale)}</td>
                  <td className="text-mist">{player.lastSeenAt ? formatAgo(player.lastSeenAt, locale) : "—"}</td>
                  <td className={TABLE.number}>{number(player.games)}</td>
                  <td className={TABLE.number}>฿ {number(playerBounty(player))}</td>
                  <td className={TABLE.number}>{number(player.berrys)}</td>
                  <td className={TABLE.number}>{number(player.cards)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {list.pages > 1 && (
        <nav aria-label={t("Pages", "Pages")} className="flex items-center justify-between gap-3 text-sm font-bold">
          {list.page > 1 ? (
            <Link href={href({ page: list.page - 1 })} className={pill(false)}>
              {t("Précédents", "Previous")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-mist">{t(`Page ${list.page} sur ${list.pages}`, `Page ${list.page} of ${list.pages}`)}</span>
          {list.page < list.pages ? (
            <Link href={href({ page: list.page + 1 })} className={pill(false)}>
              {t("Suivants", "Next")}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
