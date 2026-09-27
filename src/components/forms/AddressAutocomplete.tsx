"use client";

import { useEffect, useRef, useState } from "react";
import { Field } from "./Field";

export interface ParsedAddress {
  street: string;
  suburb: string;
  state: string;
  postcode: string;
}

let loaderPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return loaderPromise;
}

function parsePlace(components: google.maps.places.AddressComponent[]): ParsedAddress {
  const get = (type: string, useShort = false) => {
    const c = components.find((c) => c.types.includes(type));
    return (useShort ? c?.shortText : c?.longText) ?? "";
  };

  const street = [get("street_number"), get("route")].filter(Boolean).join(" ");
  const suburb = get("locality") || get("sublocality") || get("postal_town");
  const state = get("administrative_area_level_1", true);
  const postcode = get("postal_code");

  return { street, suburb, state, postcode };
}

/**
 * Street-address input backed by the Places API (New) AutocompleteSuggestion
 * service, with a small custom dropdown — the classic google.maps.places.
 * Autocomplete widget depends on the legacy Places API backend, which is
 * unreliable to provision; this only needs Places API (New).
 */
export function AddressAutocomplete({
  label = "Street address",
  required,
  value,
  onChange,
  onAddressSelect,
}: {
  label?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  onAddressSelect: (address: ParsedAddress) => void;
}) {
  const [ready, setReady] = useState(false);
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => !cancelled && setReady(true))
      .catch(() => {
        // No autocomplete available (network/key issue) — input still works as plain text.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleInput = (text: string) => {
    onChange(text);
    if (!ready || !text.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { AutocompleteSessionToken, AutocompleteSuggestion } = await google.maps.importLibrary("places");
      if (!sessionTokenRef.current) sessionTokenRef.current = new AutocompleteSessionToken();
      const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: text,
        includedRegionCodes: ["au"],
        sessionToken: sessionTokenRef.current,
      });
      setSuggestions(results.filter((s) => s.placePrediction));
      setOpen(true);
    }, 250);
  };

  const selectSuggestion = async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    const prediction = suggestion.placePrediction;
    if (!prediction) return;
    setOpen(false);
    onChange(prediction.text.text);

    const place = prediction.toPlace();
    await place.fetchFields({ fields: ["addressComponents"] });
    if (place.addressComponents) onAddressSelect(parsePlace(place.addressComponents));
    sessionTokenRef.current = null;
  };

  return (
    <div ref={containerRef} className="relative">
      <Field label={label} required={required}>
        <input
          type="text"
          value={value}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          autoComplete="off"
          placeholder="Start typing an address…"
          className="px-3 py-2 rounded-md border text-sm font-normal text-ink-primary placeholder-ink-muted bg-white focus:outline-none focus:ring-2 border-field-border focus:border-brand focus:ring-brand/20 transition-all"
        />
      </Field>
      {open && suggestions.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-field-border rounded-md shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectSuggestion(s)}
              className="w-full text-left px-3 py-2 text-sm text-ink-primary hover:bg-page-bg transition-colors border-b border-line-soft last:border-b-0"
            >
              {s.placePrediction?.text.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
