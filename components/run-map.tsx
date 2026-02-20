"use client"

import { useEffect, useRef } from "react"
import type { Map, Polyline, Marker } from "leaflet"
import "leaflet/dist/leaflet.css"

type LatLng = [number, number]
type RunState = "idle" | "running" | "paused"

interface RunMapProps {
  path: LatLng[]
  center: LatLng | null
  runState: RunState
  className?: string
}

const DEFAULT_CENTER: LatLng = [40.7128, -74.006] // fallback

export function RunMap({ path, center, runState, className = "" }: RunMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const polylineRef = useRef<Polyline | null>(null)
  const markerRef = useRef<Marker | null>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return

    const L = require("leaflet") as typeof import("leaflet")

    const mapCenter = center ?? (path.length > 0 ? path[path.length - 1]! : DEFAULT_CENTER)
    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        zoomControl: false,
      })
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)
      map.setView(mapCenter, 15)
      mapRef.current = map

      L.control.zoom({ position: "topright" }).addTo(map)
      setTimeout(() => map.invalidateSize(), 100)
    }

    const map = mapRef.current

    if (path.length > 0) {
      const latlngs: L.LatLngExpression[] = path.map(([lat, lng]) => [lat, lng])
      if (polylineRef.current) {
        polylineRef.current.setLatLngs(latlngs)
      } else {
        const polyline = L.polyline(latlngs, {
          color: "hsl(142, 71%, 45%)",
          weight: 5,
          opacity: 0.9,
          lineJoin: "round",
          lineCap: "round",
        }).addTo(map)
        polylineRef.current = polyline
      }
    } else if (polylineRef.current) {
      map.removeLayer(polylineRef.current)
      polylineRef.current = null
    }

    const lastPoint = path.length > 0 ? path[path.length - 1]! : null
    if (lastPoint && (runState === "running" || runState === "paused")) {
      if (!markerRef.current) {
        const icon = L.divIcon({
          className: "run-current-marker",
          html: `<div class="run-marker-pulse"></div><div class="run-marker-dot"></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })
        const marker = L.marker(lastPoint, { icon }).addTo(map)
        markerRef.current = marker
      } else {
        markerRef.current.setLatLng(lastPoint)
      }
      map.panTo(lastPoint, { animate: true, duration: 0.5 })
    } else {
      if (markerRef.current) {
        map.removeLayer(markerRef.current)
        markerRef.current = null
      }
      if (center) map.setView(center, map.getZoom(), { animate: true, duration: 0.3 })
    }

    return () => {}
  }, [path, center, runState])

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        polylineRef.current = null
        markerRef.current = null
      }
    }
  }, [])

  return <div ref={containerRef} className={`run-map-container ${className}`} />
}
