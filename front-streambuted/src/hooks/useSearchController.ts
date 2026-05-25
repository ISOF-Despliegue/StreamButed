import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SEARCH_BEHAVIOR, TEXT_LIMITS } from "../constants/textLimits";
import { normalizeSearchMatchValue, sanitizeSearchTerm } from "../utils/searchText";

export type SearchSubmitSource = "auto" | "manual";

interface UseSearchControllerOptions {
  autoDebounceMs?: number;
  manualCooldownMs?: number;
  maxLength?: number;
  minAutoLength?: number;
  onSearch: (searchTerm: string, source: SearchSubmitSource) => void | Promise<void>;
  onClear?: () => void;
}

export function useSearchController({
  autoDebounceMs = SEARCH_BEHAVIOR.autoDebounceMs,
  manualCooldownMs = SEARCH_BEHAVIOR.manualCooldownMs,
  maxLength = TEXT_LIMITS.searchTerm,
  minAutoLength = SEARCH_BEHAVIOR.minAutoLength,
  onClear,
  onSearch,
}: UseSearchControllerOptions) {
  const [searchValue, setSearchValue] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const lastSubmittedTermRef = useRef("");
  const lastManualSubmitAtRef = useRef(0);

  const normalizedSearchTerm = useMemo(
    () => sanitizeSearchTerm(searchValue),
    [searchValue]
  );
  const comparableSearchTerm = useMemo(
    () => normalizeSearchMatchValue(searchValue),
    [searchValue]
  );

  const updateSearchValue = useCallback((nextValue: string) => {
    setSearchValue(nextValue.slice(0, maxLength));
  }, [maxLength]);

  const submitSearch = useCallback((source: SearchSubmitSource) => {
    const submittedSearchTerm = sanitizeSearchTerm(searchValue);
    const comparableSubmittedSearchTerm = normalizeSearchMatchValue(searchValue);
    if (!submittedSearchTerm) {
      lastSubmittedTermRef.current = "";
      onClear?.();
      return false;
    }

    if (source === "auto" && comparableSubmittedSearchTerm.length < minAutoLength) {
      return false;
    }

    if (source === "manual") {
      const now = Date.now();
      if (now - lastManualSubmitAtRef.current < manualCooldownMs) {
        setCooldownUntil(lastManualSubmitAtRef.current + manualCooldownMs);
        return false;
      }
      lastManualSubmitAtRef.current = now;
      setCooldownUntil(now + manualCooldownMs);
    }

    if (lastSubmittedTermRef.current === comparableSubmittedSearchTerm) {
      return false;
    }

    lastSubmittedTermRef.current = comparableSubmittedSearchTerm;
    void onSearch(submittedSearchTerm, source);
    return true;
  }, [manualCooldownMs, minAutoLength, onClear, onSearch, searchValue]);

  useEffect(() => {
    if (!normalizedSearchTerm) {
      lastSubmittedTermRef.current = "";
      onClear?.();
      return undefined;
    }

    if (comparableSearchTerm.length < minAutoLength) {
      return undefined;
    }

    const timeoutId = globalThis.setTimeout(() => {
      submitSearch("auto");
    }, autoDebounceMs);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [autoDebounceMs, comparableSearchTerm, minAutoLength, normalizedSearchTerm, onClear, submitSearch]);

  useEffect(() => {
    if (!cooldownUntil) {
      return undefined;
    }

    const remainingMs = cooldownUntil - Date.now();
    if (remainingMs <= 0) {
      setCooldownUntil(0);
      return undefined;
    }

    const timeoutId = globalThis.setTimeout(() => {
      setCooldownUntil(0);
    }, remainingMs);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [cooldownUntil]);

  return {
    cooldownUntil,
    normalizedSearchTerm,
    searchValue,
    setSearchValue: updateSearchValue,
    submitSearch,
  };
}
