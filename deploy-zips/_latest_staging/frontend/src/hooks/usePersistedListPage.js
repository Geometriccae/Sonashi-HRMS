import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Persist list UI position across navigations (session tab).
 * Display/navigation only — no business logic changes.
 */

const PAGE_PREFIX = "hrms:listPage:";
const PATH_PREFIX = "hrms:listPath:";

export function readPersistedPage(key, fallback = 1) {
  try {
    const raw = sessionStorage.getItem(PAGE_PREFIX + key);
    if (raw == null || raw === "") return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
  } catch {
    return fallback;
  }
}

export function writePersistedPage(key, page) {
  try {
    const safe = Math.max(1, Math.floor(Number(page) || 1));
    sessionStorage.setItem(PAGE_PREFIX + key, String(safe));
  } catch {
    /* ignore */
  }
}

export function clearPersistedPage(key) {
  try {
    sessionStorage.removeItem(PAGE_PREFIX + key);
  } catch {
    /* ignore */
  }
}

export function readPersistedPath(key, fallback) {
  try {
    return sessionStorage.getItem(PATH_PREFIX + key) || fallback;
  } catch {
    return fallback;
  }
}

export function writePersistedPath(key, path) {
  try {
    if (path) sessionStorage.setItem(PATH_PREFIX + key, path);
  } catch {
    /* ignore */
  }
}

export function clearPersistedPath(key) {
  try {
    sessionStorage.removeItem(PATH_PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** Clear all saved list pages / return paths (session only). */
export function clearAllPersistedListState() {
  try {
    const toRemove = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k && (k.startsWith(PAGE_PREFIX) || k.startsWith(PATH_PREFIX))) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

function isHardReload() {
  try {
    const entry = performance.getEntriesByType?.("navigation")?.[0];
    if (entry && typeof entry.type === "string") {
      return entry.type === "reload";
    }
    // Legacy API
    return typeof performance !== "undefined" && performance.navigation?.type === 1;
  } catch {
    return false;
  }
}

/**
 * On browser refresh: wipe saved list positions and strip position query params
 * so every screen opens on its first page / default view.
 * SPA sidebar navigation is unaffected (not a reload).
 *
 * Call once before React mounts (e.g. in index.js).
 */
export function resetListUiOnHardReload() {
  if (!isHardReload()) return;

  clearAllPersistedListState();

  try {
    const url = new URL(window.location.href);
    const positionParams = ["page", "rpage", "tab", "type"];
    let changed = false;
    positionParams.forEach((p) => {
      if (url.searchParams.has(p)) {
        url.searchParams.delete(p);
        changed = true;
      }
    });
    if (changed) {
      const next = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "") + url.hash;
      window.history.replaceState(window.history.state, "", next);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Drop-in for useState(1) — restores last page from sessionStorage.
 */
export default function usePersistedListPage(key, initialPage = 1) {
  const [currentPage, setCurrentPageState] = useState(() =>
    readPersistedPage(key, initialPage)
  );

  const setCurrentPage = useCallback(
    (pageOrFn) => {
      setCurrentPageState((prev) => {
        const next = typeof pageOrFn === "function" ? pageOrFn(prev) : pageOrFn;
        const safe = Math.max(1, Math.floor(Number(next) || 1));
        writePersistedPage(key, safe);
        return safe;
      });
    },
    [key]
  );

  useEffect(() => {
    writePersistedPage(key, currentPage);
  }, [key, currentPage]);

  const resetToFirstPage = useCallback(() => {
    setCurrentPage(1);
  }, [setCurrentPage]);

  return [currentPage, setCurrentPage, resetToFirstPage];
}

/**
 * Reset to page 1 only when filter values actually change.
 * Safe under React Strict Mode (double effect invoke) — does not wipe restored page on mount.
 */
export function useResetPageOnFilterChange(resetToFirstPage, filters) {
  const prevSignatureRef = useRef(undefined);
  const signature = JSON.stringify(filters);

  useEffect(() => {
    if (prevSignatureRef.current === undefined) {
      prevSignatureRef.current = signature;
      return;
    }
    if (prevSignatureRef.current !== signature) {
      prevSignatureRef.current = signature;
      resetToFirstPage();
    }
  }, [signature, resetToFirstPage]);
}

/**
 * Clamp page after data exists. Never while list is empty (loading).
 */
export function useClampPersistedPage(currentPage, setCurrentPage, totalPages, hasData) {
  useEffect(() => {
    if (!hasData) return;
    const max = Math.max(1, Number(totalPages) || 1);
    if (currentPage > max) setCurrentPage(max);
  }, [hasData, currentPage, totalPages, setCurrentPage]);
}

/**
 * Same resume behavior as Leave/Team Management:
 * page lives in the URL (?page=4) + sessionStorage, so sidebar/back keeps position.
 *
 * @param {object} opts
 * @param {string} opts.storageKey  e.g. "salary-slips"
 * @param {string} opts.basePath    e.g. "/salary-slips"
 * @param {string} [opts.paramName] query key, default "page"
 */
export function useUrlListPage({ storageKey, basePath, paramName = "page" }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const currentPage = Math.max(
    1,
    Number(searchParams.get(paramName)) || readPersistedPage(storageKey, 1)
  );

  const buildPath = useCallback(
    (page, params) => {
      const next = new URLSearchParams(params);
      if (page <= 1) next.delete(paramName);
      else next.set(paramName, String(page));
      const qs = next.toString();
      return qs ? `${basePath}?${qs}` : basePath;
    },
    [basePath, paramName]
  );

  const setCurrentPage = useCallback(
    (pageOrFn) => {
      setSearchParams((prev) => {
        const prevPage = Math.max(
          1,
          Number(prev.get(paramName)) || readPersistedPage(storageKey, 1)
        );
        const nextVal =
          typeof pageOrFn === "function" ? pageOrFn(prevPage) : pageOrFn;
        const safe = Math.max(1, Math.floor(Number(nextVal) || 1));
        writePersistedPage(storageKey, safe);
        const next = new URLSearchParams(prev);
        if (safe <= 1) next.delete(paramName);
        else next.set(paramName, String(safe));
        writePersistedPath(storageKey, buildPath(safe, next));
        return next;
      }, { replace: true });
    },
    [setSearchParams, paramName, storageKey, buildPath]
  );

  const resetToFirstPage = useCallback(() => {
    setCurrentPage(1);
  }, [setCurrentPage]);

  // Restore URL from session when landing without ?page=
  useEffect(() => {
    writePersistedPage(storageKey, currentPage);
    writePersistedPath(storageKey, buildPath(currentPage, searchParams));
    if (!searchParams.get(paramName) && currentPage > 1) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set(paramName, String(currentPage));
        return next;
      }, { replace: true });
    }
  }, [currentPage, storageKey, paramName]); // eslint-disable-line react-hooks/exhaustive-deps

  return [currentPage, setCurrentPage, resetToFirstPage];
}

/**
 * Persist a selected view/tab/type in URL + session (e.g. Reports → Airfare).
 * Survives sidebar navigation and browser refresh.
 *
 * @param {object} opts
 * @param {string} opts.storageKey
 * @param {string} opts.basePath
 * @param {string} [opts.paramName] default "type"
 * @param {Record<string, string>} opts.valueToSlug  e.g. { "Airfare Report": "airfare" }
 * @param {string} [opts.fallback] default ""
 */
export function useUrlListView({
  storageKey,
  basePath,
  paramName = "type",
  valueToSlug,
  fallback = "",
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const slugToValue = useMemo(() => {
    const map = {};
    Object.entries(valueToSlug || {}).forEach(([value, slug]) => {
      map[slug] = value;
    });
    return map;
  }, [valueToSlug]);

  const readSavedValue = useCallback(() => {
    try {
      const raw = sessionStorage.getItem(PAGE_PREFIX + storageKey);
      if (raw && valueToSlug && valueToSlug[raw]) return raw;
      if (raw && slugToValue[raw]) return slugToValue[raw];
      return fallback;
    } catch {
      return fallback;
    }
  }, [storageKey, valueToSlug, slugToValue, fallback]);

  const slugFromUrl = searchParams.get(paramName) || "";
  const value =
    (slugFromUrl && slugToValue[slugFromUrl]) ||
    readSavedValue() ||
    fallback;

  const setValue = useCallback(
    (nextValue) => {
      const safe =
        nextValue && valueToSlug && valueToSlug[nextValue] ? nextValue : fallback;
      const slug = safe ? valueToSlug[safe] : "";
      try {
        if (safe) sessionStorage.setItem(PAGE_PREFIX + storageKey, safe);
        else sessionStorage.removeItem(PAGE_PREFIX + storageKey);
      } catch {
        /* ignore */
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (slug) next.set(paramName, slug);
          else next.delete(paramName);
          const qs = next.toString();
          writePersistedPath(storageKey, qs ? `${basePath}?${qs}` : basePath);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams, paramName, storageKey, basePath, valueToSlug, fallback]
  );

  // Restore URL from session when landing without ?type=
  useEffect(() => {
    if (!value) {
      writePersistedPath(storageKey, basePath);
      return;
    }
    try {
      sessionStorage.setItem(PAGE_PREFIX + storageKey, value);
    } catch {
      /* ignore */
    }
    const slug = valueToSlug?.[value];
    const path = slug ? `${basePath}?${paramName}=${slug}` : basePath;
    writePersistedPath(storageKey, path);
    if (slug && !searchParams.get(paramName)) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set(paramName, slug);
        return next;
      }, { replace: true });
    }
  }, [value, storageKey, basePath, paramName]); // eslint-disable-line react-hooks/exhaustive-deps

  return [value, setValue];
}
