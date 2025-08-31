// src/NavitronPage.jsx
import React, { useState, useEffect, useRef } from "react";
import captainImg from "./captain.png";
import { usePassage } from "./PassageContext";

// Demo Vessels
const DEMO_VESSELS = {
  "Pacific Dawn": { type: "Bulk Carrier", capacity: "80,000 DWT", speed: "14 knots" },
  "Ocean Spirit": { type: "Tanker", capacity: "100,000 DWT", speed: "13 knots" },
  "Marine Star": { type: "Container Ship", capacity: "8,000 TEU", speed: "20 knots" },
};

// Demo Cargos
const DEMO_CARGOS = {
  Coal: { density: "0.8 t/m³", hazard: "Low", typicalFreight: "$15/ton" },
  "Iron Ore": { density: "2.5 t/m³", hazard: "Low", typicalFreight: "$20/ton" },
  Grain: { density: "0.75 t/m³", hazard: "Moderate (dust)", typicalFreight: "$18/ton" },
};

// Demo Ports
const DEMO_PORTS = ["Mumbai", "Singapore", "Rotterdam", "New York"];

// Demo Distances
const DISTANCES = {
  "Mumbai-Singapore": 3900,
  "Mumbai-Rotterdam": 6900,
  "Mumbai-New York": 7800,
  "Singapore-Rotterdam": 9800,
  "Singapore-New York": 9600,
  "Rotterdam-New York": 6200,
};

export default function NavitronPage() {
  // ✅ Use PassageContext for global sharing
  const { departure, destination, setDeparture, setDestination } = usePassage();

  // Local states
  const [vessel, setVessel] = useState("");
  const [cargo, setCargo] = useState("");
  const [laycanDate, setLaycanDate] = useState("");
  const [result, setResult] = useState("");

  // Chatbot states
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([
    { from: "bot", text: "Hello! You can set vessel, cargo, ports or say 'calculate'." },
  ]);
  const chatEndRef = useRef(null);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto calculate if all fields are set
  useEffect(() => {
    if (vessel && cargo && departure && destination) {
      handleCalculate();
    }
  }, [vessel, cargo, departure, destination]);

  // 🔥 NEW: Sync from PassageContext (ChatPage updates)
  useEffect(() => {
    // If ChatPage sets departure/destination, they will appear here
    if (departure && destination) {
      handleCalculate();
    }
  }, [departure, destination]);

  // Command parser
  const handleCommand = (command) => {
    let lower = command.toLowerCase();

    if (lower.includes("vessel")) {
      let found = Object.keys(DEMO_VESSELS).find((v) => lower.includes(v.toLowerCase()));
      if (found) {
        setVessel(found);
        addMessage("bot", `✅ Vessel set to ${found}`);
      }
    }
    if (lower.includes("cargo")) {
      let found = Object.keys(DEMO_CARGOS).find((c) => lower.includes(c.toLowerCase()));
      if (found) {
        setCargo(found);
        addMessage("bot", `✅ Cargo set to ${found}`);
      }
    }
    if (lower.includes("departure")) {
      let found = DEMO_PORTS.find((p) => lower.includes(p.toLowerCase()));
      if (found) {
        setDeparture({ name: found });
        addMessage("bot", `✅ Departure Port set to ${found}`);
      }
    }
    if (lower.includes("destination")) {
      let found = DEMO_PORTS.find((p) => lower.includes(p.toLowerCase()));
      if (found) {
        setDestination({ name: found });
        addMessage("bot", `✅ Destination Port set to ${found}`);
      }
    }
    if (lower.includes("date")) {
      const match = command.match(/\d{4}-\d{2}-\d{2}/);
      if (match) {
        setLaycanDate(match[0]);
        addMessage("bot", `✅ Laycan Date set to ${match[0]}`);
      }
    }
    if (lower.includes("calculate")) {
      handleCalculate();
    }
  };

  // Chat functions
  const addMessage = (from, text) => {
    setMessages((prev) => [...prev, { from, text }]);
  };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const input = chatInput.trim();
    addMessage("user", input);
    setChatInput("");
    handleCommand(input);
  };

  // Voice recognition
  const handleVoice = () => {
    const recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!recognition) {
      alert("Speech recognition not supported in this browser");
      return;
    }
    const recog = new recognition();
    recog.lang = "en-US";
    recog.start();

    recog.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      addMessage("user", "🗣️ " + transcript);
      handleCommand(transcript);
    };
  };

  // Calculation
  const handleCalculate = () => {
    if (!vessel || !cargo || !departure || !destination) {
      setResult("⚠️ Please select vessel, cargo, departure and destination.");
      return;
    }

    let from = departure.name;
    let to = destination.name;
    let distanceKey = `${from}-${to}`;
    if (!DISTANCES[distanceKey]) {
      distanceKey = `${to}-${from}`;
    }
    const distance = DISTANCES[distanceKey] || 5000;

    const fuelConsumptionPerNM = 50;
    const fuelPrice = 600;
    const fuelCost = distance * fuelConsumptionPerNM * (fuelPrice / 1000);

    const cargoInfo = DEMO_CARGOS[cargo];
    const vesselInfo = DEMO_VESSELS[vessel];
    const freightRate = parseInt(cargoInfo.typicalFreight.replace(/\D/g, ""));
    const freightCost = freightRate * 1000;

    setResult(
      `📊 Estimation complete:
- Vessel: ${vessel} (${vesselInfo.type}, Capacity: ${vesselInfo.capacity}, Speed: ${vesselInfo.speed})
- Cargo: ${cargo} (Density: ${cargoInfo.density}, Hazard: ${cargoInfo.hazard}, Freight: ${cargoInfo.typicalFreight})
- Route: ${from} → ${to} (${distance} nm)
- Laycan Date: ${laycanDate || "N/A"}
- Fuel Cost: $${fuelCost.toLocaleString()}
- Freight Cost: $${freightCost.toLocaleString()}`
    );
  };

  return (
    <div className="p-4 text-white bg-[#0a1128] min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Navitron</h1>

      <div className="grid grid-cols-3 gap-4">
        {/* Vessel */}
        <div className="p-4 bg-[#0f1b3d] rounded-2xl">
          <h2 className="font-bold mb-2">Vessel Details</h2>
          <select
            value={vessel}
            onChange={(e) => setVessel(e.target.value)}
            className="w-full p-2 rounded bg-[#0a1128] border border-blue-700"
          >
            <option value="">— Select vessel —</option>
            {Object.keys(DEMO_VESSELS).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          {vessel && (
            <ul className="mt-2 list-disc list-inside text-sm">
              <li>Type: {DEMO_VESSELS[vessel].type}</li>
              <li>Capacity: {DEMO_VESSELS[vessel].capacity}</li>
              <li>Speed: {DEMO_VESSELS[vessel].speed}</li>
            </ul>
          )}
        </div>

        {/* Cargo */}
        <div className="p-4 bg-[#0f1b3d] rounded-2xl">
          <h2 className="font-bold mb-2">Cargo Details</h2>
          <select
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            className="w-full p-2 rounded bg-[#0a1128] border border-blue-700"
          >
            <option value="">— Select cargo —</option>
            {Object.keys(DEMO_CARGOS).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          {cargo && (
            <ul className="mt-2 list-disc list-inside text-sm">
              <li>Density: {DEMO_CARGOS[cargo].density}</li>
              <li>Hazard: {DEMO_CARGOS[cargo].hazard}</li>
              <li>Freight: {DEMO_CARGOS[cargo].typicalFreight}</li>
            </ul>
          )}
        </div>

        {/* Estimation Panel */}
        <div className="p-4 bg-[#0f1b3d] rounded-2xl whitespace-pre-line">
          <h2 className="font-bold mb-2">Estimation Panel (CPMT)</h2>
          <p>{result || "Select inputs and click CALCULATE"}</p>
        </div>
      </div>

      {/* Voyage Route */}
      <div className="p-4 bg-[#0f1b3d] rounded-2xl mt-4">
        <h2 className="font-bold mb-2">Voyage Route</h2>
        <div className="grid grid-cols-3 gap-2">
          <select
            value={departure?.name || ""}
            onChange={(e) => setDeparture({ name: e.target.value })}
            className="p-2 rounded bg-[#0a1128] border border-blue-700"
          >
            <option value="">— Select departure —</option>
            {DEMO_PORTS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>

          <select
            value={destination?.name || ""}
            onChange={(e) => setDestination({ name: e.target.value })}
            className="p-2 rounded bg-[#0a1128] border border-blue-700"
          >
            <option value="">— Select destination —</option>
            {DEMO_PORTS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>

          <input
            type="date"
            value={laycanDate}
            onChange={(e) => setLaycanDate(e.target.value)}
            className="p-2 rounded bg-[#0a1128] border border-blue-700"
          />
        </div>
      </div>

      {/* Calculate button */}
      <div className="mt-4">
        <button
          onClick={handleCalculate}
          className="w-full p-4 bg-blue-600 rounded-2xl font-bold"
        >
          CALCULATE
        </button>
      </div>

      {/* Chatbot + Captain Voice Assistant */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="col-span-2 p-4 bg-[#0f1b3d] rounded-2xl h-64 flex flex-col">
          <h2 className="font-bold mb-2">Chatbot</h2>
          <div className="flex-1 overflow-y-auto space-y-2">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`p-2 rounded ${
                  m.from === "user" ? "bg-blue-700 text-right" : "bg-gray-700"
                }`}
              >
                {m.text}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleChatSubmit} className="mt-2 flex">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 p-2 rounded bg-[#0a1128] border border-blue-700"
              placeholder="Type a command..."
            />
            <button className="ml-2 px-4 bg-blue-600 rounded">Send</button>
          </form>
        </div>

        {/* Captain Image for Voice */}
        <div className="p-4 bg-[#0f1b3d] rounded-2xl flex flex-col items-center justify-center">
          <h2 className="font-bold mb-2">Voice Assistant</h2>
          <button onClick={handleVoice}>
            <img
              src={captainImg}
              alt="Captain"
              className="w-24 h-24 rounded-full border-4 border-blue-600"
            />
          </button>
          <p className="mt-2 text-sm">Click the Captain & speak a command</p>
        </div>
      </div>
    </div>
  );
}
