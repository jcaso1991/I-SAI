import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  markers: { pos: [number, number]; color: string; title: string }[];
  allPoints: [number, number][];
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  if (points.length > 0) {
    setTimeout(() => map.fitBounds(points, { padding: [20, 20] }), 200);
  }
  return null;
}

export default function LeafletMap({ markers, allPoints }: Props) {
  return (
    <MapContainer center={[40.4168, -3.7038]} zoom={6} style={{ height: "100%", width: "100%", minHeight: 500 }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((m, i) => (
        <CircleMarker key={i} center={m.pos} radius={9} pathOptions={{ fillColor: m.color, color: "#fff", weight: 2, fillOpacity: 0.9 }}>
          <Popup><div dangerouslySetInnerHTML={{ __html: m.title }} /></Popup>
        </CircleMarker>
      ))}
      <FitBounds points={allPoints} />
    </MapContainer>
  );
}
