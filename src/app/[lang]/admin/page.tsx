import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminHeader, pill, TABLE, Tile } from "@/components/admin/AdminUi";
import { DayChart, type DayPoint } from "@/components/admin/DayChart";
import Link from "@/components/Link";
import { formatNumber } from "@/games/engine/text";
import { formatAgo, formatDay, gameTitle } from "@/lib/admin/format";
import { getLocale, getT } from "@/lib/i18n/server";
import { ADMIN_PERIODS, adminOverview, DEFAULT_ADMIN_PERIOD, type AdminDay } from "@/lib/server/admin";
import { currentAdmin } from "@/lib/server/admin-access";

export async function generateMetadata(): Promise<Metadata> {
  // Le titre ne doit pas trahir la page : sans administrateur, ce sont les métadonnées de la 404 qui servent
  if (!(await currentAdmin())) notFound();
  const t = await getT();
  return { title: t("Administration", "Administration"), robots: { index: false, follow: false } };
}

export default async function AdminPage({ searchParams }: PageProps<"/[lang]/admin">) {
  const { jours } = await searchParams;
  const period = ADMIN_PERIODS.find((days) => String(days) === jours) ?? DEFAULT_ADMIN_PERIOD;
  // Pour tout autre visiteur qu'un administrateur, cette page n'existe pas
  const overview = await adminOverview(await currentAdmin(), period);
  if (!overview) notFound();

  const locale = await getLocale();
  const t = await getT();
  const number = (value: number) => formatNumber(value, locale);
  const today = overview.days.at(-1)!;
  const sum = (key: "signups" | "games") => overview.days.reduce((total, day) => total + day[key], 0);
  const series = (key: keyof Omit<AdminDay, "day">): DayPoint[] =>
    overview.days.map((day) => ({ short: formatDay(day.day, locale), long: formatDay(day.day, locale, true), value: day[key] }));
  const sinceLabel = t(`sur ${period} jours`, `over ${period} days`);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-7 sm:py-8">
      <AdminHeader current="overview" />
      <h1 className="sr-only">{t("Vue d'ensemble", "Overview")}</h1>

      <section aria-label={t("En ce moment", "Right now")} className="space-y-3">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Tile label={t("Comptes", "Accounts")} value={number(overview.accounts)} hint={t("depuis l'ouverture", "since launch")} />
          <Tile label={t("Inscriptions", "Sign-ups")} value={number(today.signups)} hint={t("aujourd'hui", "today")} />
          <Tile label={t("Joueurs vus", "Players seen")} value={number(overview.seen24h)} hint={t("ces dernières 24 heures", "in the last 24 hours")} />
          <Tile label={t("Joueurs vus", "Players seen")} value={number(overview.seen7d)} hint={t("ces 7 derniers jours", "in the last 7 days")} />
          <Tile
            label={t("Parties", "Games")}
            value={number(today.games)}
            hint={t(`aujourd'hui, par ${number(today.players)} joueur${today.players > 1 ? "s" : ""}`, `today, by ${number(today.players)} ${today.players === 1 ? "player" : "players"}`)}
          />
        </dl>
        <p className="text-[13px] text-mist">
          {t(
            "Seuls les comptes sont suivis : un invité joue sans rien envoyer au serveur. Les jours changent à minuit, heure de Paris.",
            "Only accounts are tracked: a guest plays without sending anything to the server. Days change at midnight, Paris time.",
          )}
          {overview.hiddenQuizzes > 0 && (
            <>
              {" "}
              <Link href="/quiz" className="font-bold text-straw underline underline-offset-4">
                {t(
                  `${overview.hiddenQuizzes} quiz masqué${overview.hiddenQuizzes > 1 ? "s" : ""} à relire`,
                  `${overview.hiddenQuizzes} hidden ${overview.hiddenQuizzes === 1 ? "quiz" : "quizzes"} to review`,
                )}
              </Link>
            </>
          )}
        </p>
      </section>

      <section aria-labelledby="periode" className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 id="periode" className="font-display text-2xl tracking-wide text-foam">
            {t("Sur la période", "Over the period")}
          </h2>
          <nav aria-label={t("Période", "Period")} className="flex gap-2 text-sm font-bold">
            {ADMIN_PERIODS.map((days) => (
              <Link
                key={days}
                href={days === DEFAULT_ADMIN_PERIOD ? "/admin" : `/admin?jours=${days}`}
                aria-current={days === period ? "true" : undefined}
                className={pill(days === period)}
              >
                {t(`${days} jours`, `${days} days`)}
              </Link>
            ))}
          </nav>
        </div>

        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Tile label={t("Inscriptions", "Sign-ups")} value={number(sum("signups"))} hint={sinceLabel} />
          <Tile label={t("Joueurs actifs", "Active players")} value={number(overview.players)} hint={t("ont terminé une partie", "finished a game")} />
          <Tile label={t("Parties", "Games")} value={number(sum("games"))} hint={t("récompensées", "rewarded")} />
          <Tile label={t("Quiz publiés", "Quizzes published")} value={number(overview.quizzes)} hint={sinceLabel} />
          <Tile label={t("Échanges proposés", "Trades offered")} value={number(overview.trades)} hint={sinceLabel} />
        </dl>

        <div className="grid gap-4 lg:grid-cols-3">
          <DayChart
            title={t("Inscriptions par jour", "Sign-ups per day")}
            summary={t(`${number(sum("signups"))} au total`, `${number(sum("signups"))} in total`)}
            points={series("signups")}
          />
          <DayChart
            title={t("Joueurs actifs par jour", "Active players per day")}
            summary={t(`${number(overview.players)} différents`, `${number(overview.players)} distinct`)}
            points={series("players")}
          />
          <DayChart
            title={t("Parties par jour", "Games per day")}
            summary={t(`${number(sum("games"))} au total`, `${number(sum("games"))} in total`)}
            points={series("games")}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="jeux" className="space-y-3">
          <h2 id="jeux" className="font-display text-2xl tracking-wide text-foam">
            {t("Jeux les plus joués", "Most played games")}
          </h2>
          {overview.topGames.length === 0 ? (
            <p className="text-mist">{t("Aucune partie sur la période.", "No games over the period.")}</p>
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
                      {t("Joueurs", "Players")}
                    </th>
                  </tr>
                </thead>
                <tbody className={TABLE.body}>
                  {overview.topGames.map((game) => (
                    <tr key={game.slug}>
                      <td className="font-bold text-foam">{gameTitle(game.slug, locale)}</td>
                      <td className={TABLE.number}>{number(game.games)}</td>
                      <td className={TABLE.number}>{number(game.players)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="inscrits" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="inscrits" className="font-display text-2xl tracking-wide text-foam">
              {t("Dernières inscriptions", "Latest sign-ups")}
            </h2>
            <Link href="/admin/joueurs" className="text-sm font-bold text-straw underline underline-offset-4">
              {t("Tous les joueurs", "All players")}
            </Link>
          </div>
          {overview.latest.length === 0 ? (
            <p className="text-mist">{t("Aucun compte pour l'instant.", "No accounts yet.")}</p>
          ) : (
            <div className={TABLE.wrapper}>
              <table className={TABLE.table}>
                <thead className={TABLE.head}>
                  <tr>
                    <th scope="col">{t("Pseudo", "Username")}</th>
                    <th scope="col">{t("Inscrit", "Signed up")}</th>
                    <th scope="col" className={TABLE.number}>
                      {t("Parties", "Games")}
                    </th>
                  </tr>
                </thead>
                <tbody className={TABLE.body}>
                  {overview.latest.map((player) => (
                    <tr key={player.id}>
                      <td>
                        <Link href={`/admin/joueurs/${player.id}`} className="font-bold text-foam hover:text-straw">
                          {player.username}
                        </Link>
                      </td>
                      <td className="text-mist">{formatAgo(player.createdAt, locale)}</td>
                      <td className={TABLE.number}>{number(player.games)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
