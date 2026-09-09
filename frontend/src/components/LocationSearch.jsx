import React, { useState, useEffect, useRef } from "react";

export default function LocationSearch({ onSelectLocation, onSearchSubmit, loading }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch village/panchayat recommendations from Nominatim API
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=6&addressdetails=1`
        );
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(data || []);
        setShowDropdown(true);
      } catch (err) {
        console.error("Autocomplete search error", err);
      }
    }, 280); // 280ms debounce

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSelect = (item) => {
    const displayName = item.address?.village || item.address?.suburb || item.address?.town || item.address?.city || item.display_name.split(",")[0];
    const fullText = `${displayName} (${item.address?.state_district || item.address?.state || ""})`;
    setQuery(displayName);
    setShowDropdown(false);
    
    if (onSelectLocation) {
      onSelectLocation({
        name: displayName,
        fullName: fullText,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        type: item.type || "place",
      });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      setShowDropdown(false);
      if (onSearchSubmit) onSearchSubmit(query);
    }
  };

  return (
    <div className="location-search-container" ref={containerRef}>
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          placeholder="Search village, panchayat, town (e.g. Nungambakkam, Velachery)..."
        />
        {query && (
          <button className="clear-btn" onClick={() => { setQuery(""); setSuggestions([]); }}>
            ✕
          </button>
        )}
        <button
          className="search-submit-btn"
          onClick={() => { setShowDropdown(false); if (onSearchSubmit) onSearchSubmit(query); }}
          disabled={loading}
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {/* Autocomplete Dropdown List */}
      {showDropdown && suggestions.length > 0 && (
        <ul className="suggestions-dropdown">
          {suggestions.map((item, idx) => {
            const mainName = item.address?.village || item.address?.suburb || item.address?.town || item.address?.city || item.display_name.split(",")[0];
            const subText = item.display_name;
            const placeType = item.type || item.class || "location";

            return (
              <li key={idx} className="suggestion-item" onClick={() => handleSelect(item)}>
                <span className="suggestion-icon">📍</span>
                <div className="suggestion-text">
                  <strong className="suggestion-title">{mainName}</strong>
                  <span className="suggestion-sub">{subText}</span>
                </div>
                <span className="suggestion-badge">{placeType}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
