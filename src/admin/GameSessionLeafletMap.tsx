"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "./gameSessionMap.css";
import type { MapLocation } from "./gameLocationMap";

export interface MapFocusRequest { id: string | null; sequence: number }

export default function GameSessionLeafletMap({ locations, view, focus, onSelect }: {
  locations: MapLocation[];
  view: "countries" | "cities";
  focus: MapFocusRequest | null;
  onSelect: (id: string) => void;
}) {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const selectRef = useRef(onSelect);
  const [tileError, setTileError] = useState(false);
  const color = theme.palette.primary.main;
  const dark = theme.palette.mode === "dark";

  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!containerRef.current) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const map = L.map(containerRef.current, {
      center: [20, 0], zoom: 2, minZoom: 1, maxZoom: 18,
      scrollWheelZoom: false, zoomAnimation: !reduceMotion,
      fadeAnimation: !reduceMotion, markerZoomAnimation: !reduceMotion,
      maxBounds: [[-85, -180], [85, 180]], maxBoundsViscosity: 0.8,
    });
    mapRef.current = map;
    map.zoomControl.setPosition("bottomleft");
    map.zoomControl.getContainer()?.querySelector(".leaflet-control-zoom-in")?.setAttribute("aria-label", "Acercar mapa");
    map.zoomControl.getContainer()?.querySelector(".leaflet-control-zoom-out")?.setAttribute("aria-label", "Alejar mapa");

    // Only visible tiles are requested. Browser HTTP caching honors OSM policy.
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19, noWrap: true, className: "ponchister-map-tiles",
    }).addTo(map);
    tiles.on("tileerror", () => setTileError(true));
    tiles.on("tileload", () => setTileError(false));

    const weights = new WeakMap<L.Marker, number>();
    const format = new Intl.NumberFormat("es-CL");
    const cluster = L.markerClusterGroup({
      maxClusterRadius: 45, showCoverageOnHover: false,
      // Synchronous cluster updates keep ranking focus reliable during zoom.
      animate: false, spiderfyOnMaxZoom: true,
      iconCreateFunction: group => {
        const count = group.getAllChildMarkers().reduce((sum, marker) => sum + (weights.get(marker) ?? 0), 0);
        return L.divIcon({
          className: "ponchister-map-marker ponchister-map-cluster",
          html: `<span>${format.format(count)}</span>`, iconSize: [48, 48],
          iconAnchor: [24, 24],
        });
      },
    });
    clusterRef.current = cluster;
    const markers = new Map<string, L.Marker>();
    for (const location of locations) {
      if (location.latitude === null || location.longitude === null) continue;
      const title = `${location.label}: ${format.format(location.count)} ${location.count === 1 ? "partida" : "partidas"}`;
      const marker = L.marker([location.latitude, location.longitude], {
        title, alt: title,
        icon: L.divIcon({
          className: "ponchister-map-marker",
          html: `<span>${format.format(location.count)}</span>`,
          iconSize: [36, 36], iconAnchor: [18, 18],
        }),
      });
      weights.set(marker, location.count);
      // Location strings can come from headers; never interpolate them as HTML.
      const popup = document.createElement("div");
      const heading = document.createElement("strong");
      heading.textContent = location.label;
      const detail = document.createElement("div");
      detail.textContent = location.detail;
      const count = document.createElement("div");
      count.textContent = `${format.format(location.count)} ${location.count === 1 ? "partida" : "partidas"} · ubicación aproximada`;
      popup.append(heading, detail, count);
      marker.bindPopup(popup);
      marker.on("click", () => selectRef.current(location.id));
      markers.set(location.id, marker);
      cluster.addLayer(marker);
    }
    markersRef.current = markers;
    map.addLayer(cluster);
    if (markers.size) map.fitBounds(cluster.getBounds(), { padding: [45, 45], maxZoom: view === "cities" ? 8 : 4, animate: false });
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      tiles.off();
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      markersRef.current.clear();
    };
  }, [locations, view]);

  useEffect(() => {
    if (!focus || !mapRef.current) return;
    const map = mapRef.current;
    if (focus.id === null) {
      map.closePopup();
      map.setView([20, 0], 2, { animate: false });
      return;
    }
    const marker = markersRef.current.get(focus.id);
    if (!marker || !clusterRef.current) return;
    map.setView(marker.getLatLng(), view === "cities" ? 9 : 4, { animate: false });
    clusterRef.current.zoomToShowLayer(marker, () => marker.openPopup());
  }, [focus, locations, view]);

  return (
    <Box className={`ponchister-game-map${dark ? " ponchister-game-map-dark" : ""}`} sx={{ position: "relative", "--map-accent": color }}>
      <Box ref={containerRef} role="region" aria-label={`Mapa interactivo de partidas por ${view === "cities" ? "ciudad" : "país"}`} sx={{ height: { xs: 340, md: 440 }, width: "100%", zIndex: 0 }} />
      {tileError && <Typography role="status" variant="caption" sx={{ position: "absolute", top: 12, left: 12, right: 12, p: 1, bgcolor: "background.paper", borderRadius: 1, boxShadow: 1 }}>
        No se pudo cargar parte del mapa. El ranking sigue disponible.
      </Typography>}
    </Box>
  );
}
