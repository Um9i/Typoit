import { useEffect, useState, useCallback } from "react";
import type { WordlistMap } from "../types";

export interface UseWordlistResult {
  wordlist: WordlistMap;
  error: string | null;
  reload: () => void;
}

export function useWordlist(url = "wordlist.json"): UseWordlistResult {
  const [wordlist, setWordlist] = useState<WordlistMap>({});
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((data: WordlistMap) => {
        if (cancelled) return;
        setWordlist(data);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setError(
          "Could not load wordlist.json. Make sure you're serving the project over HTTP (e.g. `python3 -m http.server`) rather than opening the file directly."
        );
      });
    return () => { cancelled = true; };
  }, [url, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { wordlist, error, reload };
}
