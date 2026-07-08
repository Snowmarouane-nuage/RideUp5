import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, MapPin, ChevronLeft, ChevronRight, Wind } from "lucide-react";
import { api } from "@/lib/api";
import DangerBadge from "@/components/DangerBadge";

const PAGE_SIZE = 50;
const FEATURED_COUNTRIES = [
  "France", "Spain", "Portugal", "Morocco", "Italy", "Greece", "Brazil",
  "United States", "Australia", "United Kingdom", "Germany", "Netherlands",
];

export default function SpotCatalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [countries, setCountries] = useState([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const country = searchParams.get("country") || "";
  const search = searchParams.get("search") || "";
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);

  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    api.get("/spots/countries")
      .then((r) => {
        setCountries(r.data.countries || []);
        setCatalogTotal(r.data.catalog_total || 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const fetchCatalog = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { limit: PAGE_SIZE, offset };
    if (country) params.country = country;
    if (search.trim()) params.search = search.trim();
    api.get("/spots/catalog", { params })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [country, search, offset]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const updateParams = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === "" || v === null || v === undefined) next.delete(k);
      else next.set(k, String(v));
    });
    if (!("offset" in patch) && ("country" in patch || "search" in patch)) {
      next.delete("offset");
    }
    setSearchParams(next, { replace: true });
  };

  const onSearchSubmit = (e) => {
    e.preventDefault();
    updateParams({ search: searchInput.trim(), offset: 0 });
  };

  const matched = data?.count ?? 0;
  const pageStart = matched ? offset + 1 : 0;
  const pageEnd = Math.min(offset + PAGE_SIZE, matched);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < matched;

  const countryOptions = () => {
    const featured = FEATURED_COUNTRIES.filter((c) =>
      countries.some((x) => x.name === c)
    );
    const rest = countries
      .map((c) => c.name)
      .filter((c) => !featured.includes(c));
    return { featured, rest };
  };

  const { featured, rest } = countryOptions();

  return (
    <div className="bg-black text-white min-h-screen pt-28 pb-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-[#9AB8FF] font-display text-xs tracking-[0.3em] mb-2">MONDE · KITESURF</div>
        <h1 className="font-display text-4xl md:text-6xl mb-3">
          CATALOGUE <span className="text-[#9AB8FF]">SPOTS</span>
        </h1>
        <p className="text-gray-400 max-w-3xl mb-8">
          {(catalogTotal || data?.catalog_total || 6000).toLocaleString("fr-FR")} spots indexés dans{" "}
          {countries.length || 164} pays. Recherche par nom ou filtre par pays — consulte aussi la{" "}
          <Link to="/meilleurs-spots-kitesurf-weekend" className="text-[#9AB8FF] hover:underline">
            page week-end
          </Link>
          {country && (
            <>
              {" "}·{" "}
              <Link
                to={`/meilleurs-spots-kitesurf-weekend?country=${encodeURIComponent(country)}`}
                className="text-[#9AB8FF] hover:underline"
              >
                prévisions week-end · {country}
              </Link>
            </>
          )}
          .
        </p>

        <div className="p-4 md:p-6 border border-[#262626] bg-[#0A0A0A] mb-8 space-y-4">
          <form onSubmit={onSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                data-testid="catalog-search"
                type="search"
                placeholder="Rechercher un spot (ex. Leucate, Palm Beach, Tarifa…)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-black border border-[#262626] text-white placeholder:text-gray-600 focus:border-[#9AB8FF] outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-[#9AB8FF] hover:bg-[#7A9CE8] font-display text-sm tracking-wider transition"
            >
              RECHERCHER
            </button>
          </form>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-xs font-display tracking-wider text-gray-500 flex items-center gap-2 shrink-0">
              <MapPin className="h-3 w-3" /> PAYS
            </label>
            <select
              data-testid="catalog-country"
              value={country}
              onChange={(e) => updateParams({ country: e.target.value, offset: 0 })}
              className="flex-1 py-2.5 px-3 bg-black border border-[#262626] text-white focus:border-[#9AB8FF] outline-none"
            >
              <option value="">Tous les pays ({catalogTotal.toLocaleString("fr-FR")})</option>
              <optgroup label="Populaires">
                {featured.map((c) => {
                  const n = countries.find((x) => x.name === c)?.count;
                  return (
                    <option key={c} value={c}>
                      {c} ({n ?? "—"})
                    </option>
                  );
                })}
              </optgroup>
              <optgroup label="Tous">
                {rest.map((c) => {
                  const n = countries.find((x) => x.name === c)?.count;
                  return (
                    <option key={c} value={c}>
                      {c} ({n})
                    </option>
                  );
                })}
              </optgroup>
            </select>
          </div>

          {(search || country) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-500">Filtres actifs :</span>
              {country && (
                <FilterChip label={country} onRemove={() => updateParams({ country: "", offset: 0 })} />
              )}
              {search && (
                <FilterChip label={`« ${search} »`} onRemove={() => { setSearchInput(""); updateParams({ search: "", offset: 0 }); }} />
              )}
              <button
                type="button"
                onClick={() => { setSearchInput(""); updateParams({ country: "", search: "", offset: 0 }); }}
                className="text-[#9AB8FF] hover:underline ml-1"
              >
                Tout effacer
              </button>
            </div>
          )}
        </div>

        {!loading && data && (
          <div className="text-sm text-gray-500 mb-4 font-display tracking-wider">
            {matched.toLocaleString("fr-FR")} résultat{matched !== 1 ? "s" : ""}
            {matched > 0 && ` · ${pageStart}–${pageEnd}`}
          </div>
        )}

        {loading && (
          <div className="text-center py-20">
            <div className="h-10 w-10 mx-auto rounded-full border-4 border-[#9AB8FF] border-t-transparent animate-spin mb-4" />
            <div className="text-gray-400 font-display tracking-wider">CHARGEMENT…</div>
          </div>
        )}

        {error && <div className="text-red-400 text-center py-12">{error}</div>}

        {!loading && data?.spots?.length === 0 && (
          <div className="text-center py-16 text-gray-400 border border-[#262626]">
            Aucun spot trouvé. Essaie un autre nom ou pays.
          </div>
        )}

        {!loading && data?.spots?.length > 0 && (
          <div className="space-y-2">
            {data.spots.map((spot) => (
              <SpotRow key={spot.wg_id} spot={spot} />
            ))}
          </div>
        )}

        {!loading && matched > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#262626]">
            <button
              type="button"
              disabled={!hasPrev}
              onClick={() => updateParams({ offset: Math.max(0, offset - PAGE_SIZE) })}
              className="flex items-center gap-2 px-4 py-2 border border-[#262626] disabled:opacity-30 hover:border-[#9AB8FF] transition font-display text-sm"
            >
              <ChevronLeft className="h-4 w-4" /> PRÉCÉDENT
            </button>
            <span className="text-xs text-gray-500">
              Page {Math.floor(offset / PAGE_SIZE) + 1} / {Math.ceil(matched / PAGE_SIZE)}
            </span>
            <button
              type="button"
              disabled={!hasNext}
              onClick={() => updateParams({ offset: offset + PAGE_SIZE })}
              className="flex items-center gap-2 px-4 py-2 border border-[#262626] disabled:opacity-30 hover:border-[#9AB8FF] transition font-display text-sm"
            >
              SUIVANT <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#9AB8FF]/10 border border-[#9AB8FF]/40 text-[#9AB8FF]">
      {label}
      <button type="button" onClick={onRemove} className="hover:text-white" aria-label="Retirer le filtre">×</button>
    </span>
  );
}

function SpotRow({ spot }) {
  return (
    <div
      data-testid={`spot-${spot.name}`}
      className="p-4 border border-[#262626] bg-[#0A0A0A] flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-[#9AB8FF]/40 transition"
    >
      <div className="min-w-0">
        <div className="font-display text-lg truncate">{spot.name}</div>
        <div className="text-xs text-gray-400 flex flex-wrap items-center gap-2 mt-1">
          <span>{spot.country}</span>
          <span>·</span>
          <span>{spot.type || "wind"} · min. {spot.min_level || spot.level}</span>
          <DangerBadge label={spot.danger_label} danger={spot.danger} />
        </div>
        {spot.hazards?.length > 0 && (
          <div className="text-[10px] text-amber-400/80 mt-1 truncate">{spot.hazards.slice(0, 3).join(" · ")}</div>
        )}
      </div>
      <div className="flex items-center gap-4 shrink-0 text-xs">
        <span className="text-gray-500 hidden sm:inline">
          {spot.lat?.toFixed(2)}, {spot.lon?.toFixed(2)}
        </span>
        <span className="text-gray-500 flex items-center gap-1">
          <Wind className="h-3 w-3" />
          {spot.ideal_kts?.[0]}–{spot.ideal_kts?.[1]} kts
        </span>
      </div>
    </div>
  );
}
