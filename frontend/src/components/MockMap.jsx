import { useEffect, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function MapClickHandler({ onPick }) {
  useMapEvents({
    click(event) {
      if (onPick) onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function MapFocus({ focus }) {
  const map = useMap();

  useEffect(() => {
    if (focus) map.setView([focus.lat, focus.lng], focus.zoom ?? 14, { animate: true });
  }, [focus, map]);

  return null;
}

function MarkerViewport({ markers, focus }) {
  const map = useMap();

  useEffect(() => {
    if (focus) return;
    const validMarkers = markers.filter((marker) => Number.isFinite(marker.lat) && Number.isFinite(marker.lng));
    if (validMarkers.length === 0) return;

    const bounds = L.latLngBounds(validMarkers.map((marker) => [marker.lat, marker.lng]));
    if (validMarkers.length === 1) {
      map.setView(bounds.getCenter(), 14, { animate: true });
    } else {
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14, animate: true });
    }
  }, [focus, markers, map]);

  return null;
}

function MarkerPopup({ marker }) {
  return (
    <div className="map-popup">
      {marker.title && <strong>{marker.title}</strong>}
      {marker.category && <div>{marker.category} · ~{marker.qtyEst} kg</div>}
      {marker.address && <div>{marker.address}</div>}
      {marker.status && <div>Status: {marker.status}</div>}
    </div>
  );
}

export default function MockMap({ area, pin, markers = [], focus, onPick, hint }) {
  const [tileError, setTileError] = useState(false);
  const center = [area?.lat ?? 16.9891, area?.lng ?? 82.2475];

  return (
    <div className="mock-map leaflet-map-wrap">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom
        className="leaflet-map"
        zoomControl
      >
        <MapFocus focus={focus} />
        <MarkerViewport markers={markers} focus={focus} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{ tileerror: () => setTileError(true) }}
        />
        {onPick && <MapClickHandler onPick={onPick} />}
        {pin && (
          <Marker
            position={[pin.lat, pin.lng]}
            icon={defaultIcon}
            draggable={Boolean(onPick)}
            eventHandlers={onPick ? {
              dragend: (event) => {
                const position = event.target.getLatLng();
                onPick(position.lat, position.lng);
              },
            } : undefined}
          >
            <Popup>Pickup location</Popup>
          </Marker>
        )}
        {focus && !pin && (
          <Marker position={[focus.lat, focus.lng]} icon={defaultIcon}>
            <Popup>{focus.label || 'Selected location'}</Popup>
          </Marker>
        )}
        {markers.map((marker, index) => (
          <Marker key={`${marker.lat}-${marker.lng}-${index}`} position={[marker.lat, marker.lng]} icon={defaultIcon}>
            <Popup><MarkerPopup marker={marker} /></Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="map-hint">{hint}</div>
      {tileError && <div className="map-tile-warning">Map tiles could not load. Your dashboard is still available.</div>}
    </div>
  );
}
