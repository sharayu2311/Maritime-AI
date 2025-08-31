// src/PassagePlanningPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import { ports } from "./data/ports.js";
import { bunkerPorts } from "./data/bunker.js";
import { usePassage } from "./PassageContext.jsx";
import captainImg from "./captain.png";

/** ---- Leaflet default marker fix (for Vite) ---- */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

/** ---- Helpers ---- */
const norm = (s) => (s || "").toString().toLowerCase().replace(/\s+/g, " ").trim();

function findPortByName(name) {
  const q = norm(name);
  if (!q) return null;

  // exact
  let m = ports.find((p) => norm(p.name) === q);
  if (m) return m;

  // contains
  m = ports.find((p) => norm(p.name).includes(q) || q.includes(norm(p.name)));
  return m || null;
}

function parseFromTo(text) {
  // handles "passage planning from X to Y" or just "from X to Y"
  const m = text.match(/from\s+([a-zA-Z\s.'-]+?)\s+to\s+([a-zA-Z\s.'-]+)/i);
  if (!m) return null;
  return { from: m[1].trim(), to: m[2].trim() };
}

function midpoint(a, b) {
  if (!a || !b) return [20, 40];
  return [(a.lat + b.lat) / 2, (a.lon + b.lon) / 2];
}

function boundsForRoute(a, b) {
  if (!a || !b) return null;
  return L.latLngBounds(
    L.latLng(a.lat, a.lon),
    L.latLng(b.lat, b.lon)
  ).pad(0.2);
}

/** Fit the map view to the current route when it changes */
function FitOnRoute({ dep, dest }) {
  const map = useMap();
  useEffect(() => {
    const b = boundsForRoute(dep, dest);
    if (b) map.fitBounds(b, { animate: true });
  }, [dep, dest, map]);
  return null;
}

export default function PassagePlanningPage() {
  const { departure, destination, setDeparture, setDestination, setPassage } = usePassage();

  // local UI state (chat + voice)
  const [messages, setMessages] = useState([
    { from: "bot", text: "Ahoy! Tell me a route like: 'from Dubai to Shanghai' ⚓" },
  ]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  // derive route and map center
  const route = useMemo(() => {
    if (departure && destination) {
      return [
        [departure.lat, departure.lon],
        [destination.lat, destination.lon],
      ];
    }
    return [];
  }, [departure, destination]);

  const mapCenter = useMemo(() => midpoint(departure, destination), [departure, destination]);

  /** ---- Actions that set the shared passage context ---- */
  const applyRoute = (depPort, destPort) => {
    if (depPort) setDeparture(depPort);
    if (destPort) setDestination(destPort);
  };

  const applyRouteViaStrings = (fromName, toName) => {
    const dep = findPortByName(fromName);
    const dest = findPortByName(toName);
    if (dep || dest) {
      setPassage({ departure: dep || fromName, destination: dest || toName });
    }
    return { dep, dest };
  };

  /** ---- Chat handling ---- */
  const addMsg = (from, text) => setMessages((m) => [...m, { from, text }]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    addMsg("user", text);

    const parsed = parseFromTo(text);
    if (parsed) {
      const { from, to } = parsed;
      const { dep, dest } = applyRouteViaStrings(from, to);

      if (dep && dest) {
        addMsg("bot", `Setting route: ${dep.name} → ${dest.name}`);
      } else if (!dep && !dest) {
        addMsg("bot", `I couldn't find those ports. Try exact names from the dropdowns.`);
      } else if (!dep) {
        addMsg("bot", `Found destination "${dest.name}", but couldn't match the departure.`);
      } else {
        addMsg("bot", `Found departure "${dep.name}", but couldn't match the destination.`);
      }
    } else {
      addMsg("bot", "Okay! You can also say: 'from Dubai to Shanghai'.");
    }

    setInput("");
  };

  /** ---- Voice handling ---- */
  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      addMsg("bot", "Your browser does not support voice recognition.");
      return;
    }
    const rec = new SR();
    recRef.current = rec;
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;

    let finalText = "";

    rec.onstart = () => setListening(true);
    rec.onend = () => {
      setListening(false);
      if (finalText) {
        setInput(""); // make sure input is clear
        addMsg("user", finalText);
        const parsed = parseFromTo(finalText);
        if (parsed) {
          const { from, to } = parsed;
          const { dep, dest } = applyRouteViaStrings(from, to);
          if (dep && dest) {
            addMsg("bot", `Setting route: ${dep.name} → ${dest.name}`);
          } else if (!dep && !dest) {
            addMsg("bot", `I couldn't find those ports. Try exact names from the dropdowns.`);
          } else if (!dep) {
            addMsg("bot", `Found destination "${dest.name}", but couldn't match the departure.`);
          } else {
            addMsg("bot", `Found departure "${dep.name}", but couldn't match the destination.`);
          }
        } else {
          addMsg("bot", "Say something like: 'from Singapore to Rotterdam'.");
        }
      }
    };
    rec.onresult = (e) => {
      let transcript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += transcript;
      }
    };
    rec.start();
  };

  const stopVoice = () => {
    try {
      recRef.current && recRef.current.stop();
    } catch {}
  };

  /** ---- UI ---- */
  return (
    <div
      style={{
        height: "100vh",
        width: "100%",
        display: "grid",
        gridTemplateColumns: "1fr 380px",   // map | right panel
        gridTemplateRows: "1fr 250px",      // main row | bottom chat row
        gridTemplateAreas: `
          "map right"
          "chat chat"
        `,
        background: "#0a0e1a",
        color: "#fff",
      }}
    >
      {/* MAP (center) */}
      <div style={{ gridArea: "map", position: "relative" }}>
        <MapContainer center={mapCenter} zoom={departure && destination ? 5 : 3} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {departure && (
            <Marker position={[departure.lat, departure.lon]}>
              <Popup>{departure.name} (Departure)</Popup>
            </Marker>
          )}
          {destination && (
            <Marker position={[destination.lat, destination.lon]}>
              <Popup>{destination.name} (Destination)</Popup>
            </Marker>
          )}

          {route.length > 0 && <Polyline positions={route} />}

          {/* bunker ports */}
          {bunkerPorts.map((bp) => (
            <Marker key={bp.id} position={[bp.lat, bp.lon]}>
              <Popup>
                <strong>{bp.name}</strong>
                <br />
                Fuel: {bp.fuelTypes?.join(", ") || "—"}
                <br />
                Availability: {bp.availability || "—"}
              </Popup>
            </Marker>
          ))}

          {/* auto-fit on route change */}
          <FitOnRoute dep={departure} dest={destination} />
        </MapContainer>
      </div>

      {/* RIGHT PANEL (details) */}
      <div
        style={{
          gridArea: "right",
          background: "#0f1426",
          borderLeft: "1px solid #1d2442",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 8px" }}>
          <img src={captainImg} alt="Captain" style={{ width: 44, height: 44, objectFit: "contain" }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Oceanova</div>
            <div style={{ fontSize: 12, color: "#9fb0ff" }}>Set route via panel, chat, or voice</div>
          </div>
        </div>

        <div style={{ padding: "8px 16px 16px", display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12, color: "#8aa0ff" }}>Departure</div>
          <select
            value={departure ? departure.id : ""}
            onChange={(e) => {
              const p = ports.find((x) => x.id === parseInt(e.target.value));
              applyRoute(p, destination || null);
            }}
            style={{
              background: "#121a33",
              color: "#fff",
              border: "1px solid #25305b",
              padding: "8px",
              borderRadius: 10,
            }}
          >
            <option value="">-- Select --</option>
            {ports.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <div style={{ fontSize: 12, color: "#8aa0ff", marginTop: 8 }}>Destination</div>
          <select
            value={destination ? destination.id : ""}
            onChange={(e) => {
              const p = ports.find((x) => x.id === parseInt(e.target.value));
              applyRoute(departure || null, p);
            }}
            style={{
              background: "#121a33",
              color: "#fff",
              border: "1px solid #25305b",
              padding: "8px",
              borderRadius: 10,
            }}
          >
            <option value="">-- Select --</option>
            {ports.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <div
            style={{
              marginTop: 14,
              background: "#0c1329",
              border: "1px solid #25305b",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <div style={{ fontSize: 12, color: "#9fb0ff", marginBottom: 6 }}>Summary</div>
            <div style={{ fontSize: 14, lineHeight: 1.4 }}>
              {departure && destination ? (
                <>
                  Route: <strong>{departure.name}</strong> → <strong>{destination.name}</strong>
                </>
              ) : (
                "Pick departure and destination or use chat/voice."
              )}
            </div>
          </div>

          {/* (Placeholder) room for ETA, distance, weather widgets later */}
          <div
            style={{
              marginTop: 10,
              background: "#0c1329",
              border: "1px solid #25305b",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <div style={{ fontSize: 12, color: "#9fb0ff", marginBottom: 6 }}>Extras</div>
            <div style={{ fontSize: 13, color: "#b8c4ff" }}>
              Add distance/ETA/weather widgets here later.
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM CHAT (chat + voice) */}
      <div
        style={{
          gridArea: "chat",
          background: "linear-gradient(180deg,#0d1330,#0a0f23)",
          borderTop: "1px solid #1d2442",
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: 16,
          padding: 16,
        }}
      >
        {/* message history */}
        <div
          style={{
            background: "#0c1329",
            border: "1px solid #25305b",
            borderRadius: 14,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div style={{ fontSize: 13, color: "#9fb0ff", marginBottom: 6 }}>Mini Chat</div>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              background: "#0b1124",
              border: "1px solid #1c2852",
              borderRadius: 10,
              padding: 10,
              minHeight: 120,
              maxHeight: 160,
            }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.from === "user" ? "flex-end" : "flex-start",
                  margin: "4px 0",
                }}
              >
                <div
                  style={{
                    background: m.from === "user" ? "#2e5cff" : "#1a2448",
                    color: "#fff",
                    border: "1px solid #2f3e79",
                    padding: "8px 10px",
                    borderRadius: 12,
                    maxWidth: "70%",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* input row */}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder='Type: "from Dubai to Shanghai"'
              style={{
                flex: 1,
                background: "#101735",
                color: "#fff",
                border: "1px solid #25305b",
                borderRadius: 10,
                padding: "10px 12px",
              }}
            />
            <button
              onClick={handleSend}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                background: "#2e5cff",
                color: "#fff",
                border: "1px solid #2f3e79",
                cursor: "pointer",
                fontWeight: 600,
              }}
              aria-label="Send message"
            >
              Send
            </button>
            <button
              onClick={listening ? stopVoice : startVoice}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                background: listening ? "#d32f2f" : "#1aa262",
                color: "#fff",
                border: "1px solid #2f3e79",
                cursor: "pointer",
                fontWeight: 600,
              }}
              aria-label="Toggle voice input"
            >
              {listening ? "Stop 🎙" : "Speak 🎤"}
            </button>
          </div>
        </div>

        {/* helper card */}
        <div
          style={{
            background: "#0c1329",
            border: "1px solid #25305b",
            borderRadius: 14,
            padding: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <img src={captainImg} alt="Captain" style={{ width: 36, height: 36, objectFit: "contain" }} />
            <div style={{ fontWeight: 700 }}>Tips</div>
          </div>
          <div style={{ fontSize: 13, color: "#b8c4ff", lineHeight: 1.5 }}>
            • Try: <code>from Singapore to Rotterdam</code>
            <br />
            • Or select ports on the right.
            <br />
            • Voice works with the same phrases.
          </div>
        </div>
      </div>
    </div>
  );
}
