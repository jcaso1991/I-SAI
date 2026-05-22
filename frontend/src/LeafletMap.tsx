import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  markers: { pos: [number, number]; color: string; title: string }[];
  allPoints: [number, number][];
}

/**
 * Forces the Leaflet map to re-measure its container after mount + on resize.
 * Without this, when the map is inside a flex parent whose final size is
 * computed after JS init, Leaflet thinks the container is 0×0 and never
 * requests any tile (the map stays empty / light-blue).
 */
function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => {
    const tick = () => map.invalidateSize();
    // Multiple ticks because layout settles asynchronously.
    const t1 = setTimeout(tick, 50);
    const t2 = setTimeout(tick, 250);
    const t3 = setTimeout(tick, 700);
    window.addEventListener("resize", tick);
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      window.removeEventListener("resize", tick);
    };
  }, [map]);
  return null;
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const t = setTimeout(() => {
        try { map.fitBounds(points, { padding: [40, 40] }); } catch {}
      }, 400);
      return () => clearTimeout(t);
    }
  }, [map, points]);
  return null;
}

export default function LeafletMap({ markers, allPoints }: Props) {
  return (
    <MapContainer
      center={[40.4168, -3.7038]}
      zoom={6}
      style={{ height: "100%", width: "100%", minHeight: 500, background: "#e5e7eb" }}
      preferCanvas
      worldCopyJump
    >
      <InvalidateOnMount />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        crossOrigin
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
