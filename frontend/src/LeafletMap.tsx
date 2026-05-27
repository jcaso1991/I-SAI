import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";

interface Props {
  markers: { pos: [number, number]; color: string; title: string }[];
  allPoints: [number, number][];
}

function useLeafletCSS() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById("leaflet-css")) return;
    const link = document.createElement("link");
    link.id = "leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }, []);
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const t = setTimeout(() => {
      try {
        map.invalidateSize();
        map.fitBounds(points, { padding: [40, 40] });
      } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [map, points]);
  return null;
}

export default function LeafletMap({ markers, allPoints }: Props) {
  useLeafletCSS();

  return (
    <MapContainer
      center={[40.4168, -3.7038]}
      zoom={6}
      style={{ height: "calc(100vh - 260px)", width: "100%", minHeight: 400 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      {markers.map((m, i) => (
        <CircleMarker
          key={i}
          center={m.pos}
          radius={9}
          pathOptions={{ fillColor: m.color, color: "#fff", weight: 2, fillOpacity: 0.9 }}
        >
          <Popup>
            <div dangerouslySetInnerHTML={{ __html: m.title }} />
          </Popup>
        </CircleMarker>
      ))}
      <FitBounds points={allPoints} />
    </MapContainer>
  );
}
