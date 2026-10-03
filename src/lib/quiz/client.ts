"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { QuizDetail, QuizList } from "./types";

/**
 * Liste des quiz de la communauté, tous ou seulement ceux rédigés dans `language` ;
 * `reload` la relit après une création ou une suppression.
 */
export function useQuizList(sort: "recent" | "top", language: Locale | null): { list: QuizList | null; reload: () => void } {
  const [loaded, setLoaded] = useState<{ list: QuizList } | null>(null);
  const [kick, setKick] = useState(0);
  const reload = useCallback(() => setKick((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/quizzes?sort=${sort}${language ? `&lang=${language}` : ""}`, { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<QuizList>) : null))
      .catch(() => null)
      .then((list) => {
        if (!cancelled) setLoaded({ list: list ?? { enabled: false, quizzes: [], mine: [], drafts: [], hidden: [], isAdmin: false } });
      });
    return () => {
      cancelled = true;
    };
  }, [sort, language, kick]);

  return { list: loaded?.list ?? null, reload };
}

/** Un quiz et ses questions : `null` pendant le chargement, `"missing"` s'il n'existe pas (ou plus). */
export function useQuiz(id: string): { quiz: QuizDetail | "missing" | null; reload: () => void } {
  const [loaded, setLoaded] = useState<{ id: string; quiz: QuizDetail | "missing" } | null>(null);
  const [kick, setKick] = useState(0);
  const reload = useCallback(() => setKick((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/quizzes/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((response): Promise<QuizDetail | "missing"> => (response.ok ? response.json() : Promise.resolve("missing")))
      .catch((): "missing" => "missing")
      .then((quiz) => {
        if (!cancelled) setLoaded({ id, quiz });
      });
    return () => {
      cancelled = true;
    };
  }, [id, kick]);

  return { quiz: loaded?.id === id ? loaded.quiz : null, reload };
}
