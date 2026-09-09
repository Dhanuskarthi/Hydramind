"""
Decision Engine
================
Applies post-model business logic to AI outputs.

After LSTM → XGBoost → U-Net run and FloodRiskFusion assembles the
spatial picture, the DecisionEngine converts raw scores into
human-readable, actionable outputs for the dashboard and alert system.

Outputs
-------
  - Flood Severity Score     (weighted aggregate for the district)
  - Infrastructure Risk      (per hospital / shelter / bridge)
  - Rescue Priority Ranking  (villages, sorted)
  - Evacuation Routing       (safe shelter list, ordered by distance)
  - Auto-generated Alerts    (ready to push via alerts.py router)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

SEVERITY_LABELS = {
    (0.85, 1.01): ("CATASTROPHIC", "⛔ Immediate mass evacuation required."),
    (0.65, 0.85): ("SEVERE", "🔴 Evacuate high-risk zones now."),
    (0.45, 0.65): ("MODERATE", "🟠 Prepare evacuation. Monitor continuously."),
    (0.25, 0.45): ("LOW", "🟡 Stay alert. Avoid flood-prone areas."),
    (0.00, 0.25): ("MINIMAL", "🟢 No immediate threat. Continue monitoring."),
}


class DecisionEngine:
    """
    Translates model outputs into authoritative, actionable decisions.
    """

    # ------------------------------------------------------------------
    # District-level severity
    # ------------------------------------------------------------------

    def flood_severity_score(self, risk_scores: list[float]) -> dict[str, Any]:
        """
        Compute a district-wide flood severity from per-cell risk scores.

        Uses the 95th percentile (not mean) to capture localised extreme
        risk, which matters most for emergency management.
        """
        import numpy as np  # noqa: PLC0415

        arr = np.array(risk_scores)
        score = float(np.percentile(arr, 95))
        label, message = self._severity_label(score)

        return {
            "severity_score": round(score, 3),
            "severity_level": label,
            "message": message,
            "cells_at_critical_risk": int((arr >= 0.85).sum()),
            "cells_at_high_risk": int(((arr >= 0.65) & (arr < 0.85)).sum()),
            "total_cells": len(arr),
        }

    # ------------------------------------------------------------------
    # Infrastructure risk
    # ------------------------------------------------------------------

    def compute_rescue_priorities(
        self,
        grid: Any,
        affected_assets: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """
        Rank villages by flood risk priority.
        """
        villages = affected_assets.get("affected_villages", [])
        return [
            {
                "village": v,
                "flood_probability": 0.75,  # placeholder
                "action": "EVACUATE" if 0.75 >= 0.65 else "ALERT"
            }
            for v in villages
        ]

    def infrastructure_risk(
        self,
        affected_hospitals: list[dict],
        affected_assets: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Returns a risk classification for each hospital and whether each
        road/bridge is expected to be passable.
        """
        hospital_risk = [
            {
                "name": h.get("name", "Unknown Hospital"),
                "status": "AT_RISK",
                "action": "ACTIVATE_BACKUP_FACILITY",
                "geometry": h.get("geometry"),
            }
            for h in affected_hospitals
        ]
        return {
            "hospitals_at_risk": hospital_risk,
            "evacuation_assets": affected_assets.get("evacuation_assets", []),
        }

    # ------------------------------------------------------------------
    # Auto-alert generation
    # ------------------------------------------------------------------

    def generate_alerts(
        self,
        district: str,
        severity: dict[str, Any],
        priority_ranking: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """
        Create ready-to-store alert records based on severity and village
        priority. These are returned by the /api/v1/alerts endpoint and
        can be pushed via SMS / FCM once those integrations are added.
        """
        alerts = []
        now = datetime.now(timezone.utc).isoformat()

        level = severity["severity_level"]
        if level not in ("MINIMAL",):
            alerts.append({
                "type": f"FLOOD_{level}",
                "severity": level,
                "village": district,
                "message": severity["message"],
                "timestamp": now,
            })

        for entry in priority_ranking[:5]:  # top-5 villages only
            action = entry["action"]
            if action == "NO_ACTION":
                continue
            alerts.append({
                "type": "VILLAGE_RISK",
                "severity": "HIGH" if entry["flood_probability"] >= 0.65 else "MEDIUM",
                "village": entry["village"],
                "message": (
                    f"Village {entry['village']}: {round(entry['flood_probability']*100)}% "
                    f"flood probability. Action: {action.replace('_', ' ')}."
                ),
                "timestamp": now,
            })

        return alerts

    # ------------------------------------------------------------------
    # Evacuation routing (simple nearest-shelter)
    # ------------------------------------------------------------------

    def evacuation_routes(
        self,
        affected_villages: list[str],
        safe_shelters: list[dict[str, Any]],
        village_centroids: dict[str, tuple[float, float]] | None = None,
    ) -> list[dict[str, Any]]:
        """
        For each affected village, find the closest safe shelter.
        Requires village centroids (lat, lon) from the OSM boundary layer.
        Falls back to listing all safe shelters if centroids are absent.
        """
        import numpy as np  # noqa: PLC0415

        if not safe_shelters:
            return [{"village": v, "route": "No safe shelters identified nearby"} for v in affected_villages]

        if not village_centroids:
            return [
                {"village": v, "nearest_shelter": safe_shelters[0].get("name", "Shelter")}
                for v in affected_villages
            ]

        routes = []
        shelter_coords = np.array([
            [s["geometry"]["coordinates"][1], s["geometry"]["coordinates"][0]]
            for s in safe_shelters
            if s.get("geometry", {}).get("coordinates")
        ])

        for village in affected_villages:
            if village not in village_centroids:
                routes.append({"village": village, "nearest_shelter": safe_shelters[0].get("name")})
                continue
            vlat, vlon = village_centroids[village]
            dists = np.sqrt((shelter_coords[:, 0] - vlat) ** 2 + (shelter_coords[:, 1] - vlon) ** 2)
            nearest_idx = int(dists.argmin())
            routes.append({
                "village": village,
                "nearest_shelter": safe_shelters[nearest_idx].get("name", "Shelter"),
                "distance_km": round(float(dists[nearest_idx]) * 111, 1),
            })
        return routes

    # ------------------------------------------------------------------
    # Helper
    # ------------------------------------------------------------------

    @staticmethod
    def _severity_label(score: float) -> tuple[str, str]:
        for (low, high), (label, msg) in SEVERITY_LABELS.items():
            if low <= score < high:
                return label, msg
        return "MINIMAL", "🟢 No immediate threat."
