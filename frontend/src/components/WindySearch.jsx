import React, { useState, useEffect, useRef } from "react";

export default function WindySearch({ onSelectLocation, onSearchSubmit, onQuickCity, loading }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setSuggestions([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&addressdetails=1`);
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(data || []);
        setShowDropdown(true);
      } catch (err) { console.error("Search error", err); }
    }, 280);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSelect = (item) => {
    const name = item.address?.village || item.address?.suburb || item.address?.town || item.address?.city || item.display_name.split(",")[0];
    setQuery(name);
    setShowDropdown(false);
    if (onSelectLocation) onSelectLocation({ name, lat: parseFloat(item.lat), lon: parseFloat(item.lon), type: item.type || "place" });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") { setShowDropdown(false); if (onSearchSubmit) onSearchSubmit(query); }
  };

  return (
    <div className="w-search-area" ref={containerRef}>
      <div className="w-search-box">
        <span className="w-search-icon">🔍</span>
        <input
          type="text" className="w-search-input" value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          placeholder="Search world cities..."
        />
        {query && <button className="w-search-clear" onClick={() => { setQuery(""); setSuggestions([]); }}>✕</button>}
        <button className="w-search-gear" title="Settings">⚙</button>
      </div>

      {/* Quick chips */}
      <div className="w-quick-chips">
        {["Tokyo", "Mumbai", "London", "Houston", "Manila", "Sydney"].map((city) => (
          <button key={city} className="w-chip" onClick={() => { if (onQuickCity) onQuickCity(city); }}>
            {city}
          </button>
        ))}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <ul className="w-suggestions">
          {suggestions.map((item, idx) => {
            const mainName = item.address?.village || item.address?.suburb || item.address?.town || item.address?.city || item.display_name.split(",")[0];
            return (
              <li key={idx} className="w-suggestion-item" onClick={() => handleSelect(item)}>
                <span className="w-suggestion-icon">📍</span>
                <div className="w-suggestion-text">
                  <strong className="w-suggestion-title">{mainName}</strong>
                  <span className="w-suggestion-sub">{item.display_name}</span>
                </div>
                <span className="w-suggestion-badge">{item.type || "place"}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
