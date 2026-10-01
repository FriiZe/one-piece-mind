import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminHeader, TABLE, Tile } from "@/components/admin/AdminUi";
import Link from "@/components/Link";
import { DIFFICULTIES } from "@/games/engine/difficulty";
import { formatNumber } from "@/games/engine/text";
import { formatAgo, formatDateTime, gameTitle } from "@/lib/admin/format";
import { characterById } from "@/lib/data";
import { DAILY_BERRY_CAP, playerBounty, POST_IDS, rankOf } from "@/lib/economy";
import { getLocale, getT } from "@/lib/i18n/server";
import { adminUser } from "@/lib/server/admin";
import { currentUser } from "@/lib/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Fiche d'un joueur — Administration", "Player record — Administration"), robots: { index: false, follow: false } };
}

export default async function AdminPlayerPage({ params }: PageProps<"/[lang]/admin/joueurs/[id]">) {
  const { id } = await params;
  // Pour tout autre visiteur qu'un administrateur, cette page n'existe pas
  const player = await adminUser(await currentUser(), id);
  if (!player) notFound();

  const locale = await getLocale();
  const t = await getT();
  const number = (value: number) => formatNumber(value, locale);
  const bounty = playerBounty(player);
  const heading = "font-display text-2xl tracking-wide text-foam";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-7 sm:py-8">
      <AdminHeader current="players" />

      <div className="space-y-1">
        <Link href="/admin/joueurs" className="text-sm font-bold text-straw underline underline-offset-4">
          {t("Tous les joueurs", "All players")}
        </Link>
        <h1 className="font-display text-4xl tracking-wide break-all text-foam">{player.username}</h1>
        <p className="text-mist">
          {rankOf(bounty).title[locale]} · ฿ {number(bounty)}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={t("Inscrit", "Signed up")} value={formatAgo(player.createdAt, locale)} hint={formatDateTime(player.createdAt, locale)} />
        <Tile
          label={t("Dernière visite", "Last visit")}
          value={player.lastSeenAt ? formatAgo(player.lastSeenAt, locale) : "—"}
          hint={player.lastSeenAt ? formatDateTime(player.lastSeenAt, locale) : t("pas revu depuis que les visites sont notées", "not seen since visits are recorded")}
        />
        <Tile
          label={t("Dernière connexion", "Last login")}
          value={player.lastLogin ? formatAgo(player.lastLogin, locale) : "—"}
          hint={t(
            `${player.sessions} session${player.sessions > 1 ? "s" : ""} ouverte${player.sessions > 1 ? "s" : ""}`,
            `${player.sessions} open ${player.sessions === 1 ? "session" : "sessions"}`,
          )}
        />
        <Tile label={t("Parties", "Games")} value={number(player.games)} hint={t("récompensées, depuis l'inscription", "rewarded, since sign-up")} />
        <Tile
          label={t("Berrys", "Berries")}
          value={number(player.berrys)}
          hint={t(`${number(player.lifetimeBerrys)} gagnés en tout`, `${number(player.lifetimeBerrys)} earned in total`)}
        />
        <Tile
          label={t("Gagnés aujourd'hui", "Earned today")}
          value={number(player.earnedToday)}
          hint={t(`plafond : ${number(DAILY_BERRY_CAP)}`, `cap: ${number(DAILY_BERRY_CAP)}`)}
        />
        <Tile
          label={t("Collection", "Collection")}
          value={number(player.cards)}
          hint={t(
            `${number(player.copies)} exemplaires, dont ${number(player.golden)} doré${player.golden > 1 ? "s" : ""}`,
            `${number(player.copies)} copies, ${number(player.golden)} golden`,
          )}
        />
        <Tile
          label={t("Équipage", "Crew")}
          value={`${player.crew}/${POST_IDS.length}`}
          hint={t(
            `${player.friends} ami${player.friends > 1 ? "s" : ""} · ${player.trades} échange${player.trades > 1 ? "s" : ""}`,
            `${player.friends} ${player.friends === 1 ? "friend" : "friends"} · ${player.trades} ${player.trades === 1 ? "trade" : "trades"}`,
          )}
        />
      </dl>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start">
        <section aria-labelledby="parties" className="space-y-3">
          <h2 id="parties" className={heading}>
            {t("Dernières parties", "Latest games")}
          </h2>
          {player.recentGames.length === 0 ? (
            <p className="text-mist">{t("Aucune partie récompensée.", "No rewarded games.")}</p>
          ) : (
            <div className={TABLE.wrapper}>
              <table className={TABLE.table}>
                <thead className={TABLE.head}>
                  <tr>
                    <th scope="col">{t("Jeu", "Game")}</th>
                    <th scope="col">{t("Quand", "When")}</th>
                    <th scope="col">{t("Réglages", "Settings")}</th>
                    <th scope="col" className={TABLE.number}>
                      {t("Score", "Score")}
                    </th>
                    <th scope="col" className={TABLE.number}>
                      {t("Berrys", "Berries")}
                    </th>
                    <th scope="col">{t("Recrue", "Recruit")}</th>
                  </tr>
                </thead>
                <tbody className={TABLE.body}>
                  {player.recentGames.map((game) => (
                    <tr key={game.id}>
                      <td className="font-bold text-foam">{gameTitle(game.slug, locale)}</td>
                      <td className="text-mist" title={formatDateTime(game.createdAt, locale)}>
                        {formatAgo(game.createdAt, locale)}
                      </td>
                      <td className="text-mist">
                        {[
                          game.mode,
                          DIFFICULTIES.find((difficulty) => difficulty.id === game.difficulty)?.label[locale].toLowerCase() ?? game.difficulty,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </td>
                      <td className={TABLE.number}>
                        {number(game.score)}/{number(game.maxScore)}
                      </td>
                      <td className={TABLE.number}>+{number(game.berrys)}</td>
                      <td className="text-mist">{game.recruitId ? (characterById.get(game.recruitId)?.name[locale] ?? game.recruitId) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section aria-labelledby="par-jeu" className="space-y-3">
            <h2 id="par-jeu" className={heading}>
              {t("Par jeu", "By game")}
            </h2>
            {player.perGame.length === 0 ? (
              <p className="text-mist">{t("Aucun jeu joué.", "No games played.")}</p>
            ) : (
              <div className={TABLE.wrapper}>
                <table className={TABLE.table}>
                  <thead className={TABLE.head}>
                    <tr>
                      <th scope="col">{t("Jeu", "Game")}</th>
                      <th scope="col" className={TABLE.number}>
                        {t("Parties", "Games")}
                      </th>
                      <th scope="col" className={TABLE.number}>
                        {t("Meilleur", "Best")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className={TABLE.body}>
                    {player.perGame.map((game) => (
                      <tr key={game.slug}>
                        <td className="font-bold text-foam">{gameTitle(game.slug, locale)}</td>
                        <td className={TABLE.number}>{number(game.games)}</td>
                        <td className={TABLE.number}>{Math.round(game.best * 100)} %</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {player.quizzes.length > 0 && (
            <section aria-labelledby="quiz" className="space-y-3">
              <h2 id="quiz" className={heading}>
                {t("Ses quiz", "Their quizzes")}
              </h2>
              <ul className="space-y-2">
                {player.quizzes.map((quiz) => (
                  <li key={quiz.id}>
                    <Link
                      href={`/quiz/${quiz.id}`}
                      className="flex flex-col gap-0.5 rounded-2xl border border-sea-700 bg-sea-800 px-4 py-3 transition-colors hover:border-straw"
                    >
                      <span className="font-bold text-foam">{quiz.title}</span>
                      <span className="text-[13px] text-mist">
                        {[
                          quiz.status === "hidden" ? t("masqué", "hidden") : t("public", "public"),
                          t(`${number(quiz.plays)} partie${quiz.plays > 1 ? "s" : ""}`, `${number(quiz.plays)} ${quiz.plays === 1 ? "play" : "plays"}`),
                          formatAgo(quiz.createdAt, locale),
                        ].join(" · ")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
