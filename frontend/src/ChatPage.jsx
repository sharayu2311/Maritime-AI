// src/ChatPage.jsx
import { useEffect, useRef, useState } from "react";
import { Mic, Send, Upload, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import captainImg from "./captain.png";
import { usePassage } from "./PassageContext.jsx"; // ✅ global context

const DEFAULT_API = "http://localhost:8000";

// --- TIME (Option B: network-backed IST with fallback) ---
const TIMEZONE = "Asia/Kolkata";
function formatISTFromMs(ms) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIMEZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(ms));
}
function localISTFallbackString() {
  // If API is unavailable, format the client's current time as IST (Intl will adjust)
  return formatISTFromMs(Date.now());
}

export default function ChatPage() {
  const [apiBase, setApiBase] = useState(DEFAULT_API);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Ahoy! I’m Captain here to assist you with laytime, weather, distances, or CP clauses.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("chat"); // "chat" or "voice"
  const [speaking, setSpeaking] = useState(false); // ✅ new state

  // --- IST state
  const [istTime, setIstTime] = useState(localISTFallbackString());
  const istOffsetRef = useRef(0); // serverTimeMs - clientNowMs

  const chatRef = useRef(null);
  const docRef = useRef(null);
  const cpRef = useRef(null);
  const navigate = useNavigate();

  // ✅ global context
  const { setPassage, setVoyage } = usePassage();

  // --- Sync with world time API and keep ticking ---
  useEffect(() => {
    let timer = null;
    let mounted = true;

    async function initTime() {
      try {
        const res = await fetch("https://worldtimeapi.org/api/timezone/Asia/Kolkata");
        if (!res.ok) throw new Error("time api response not ok");
        const j = await res.json();
        // j.datetime example: "2025-09-01T20:04:12.345678+05:30"
        const serverMs = Date.parse(j.datetime);
        const clientMs = Date.now();
        istOffsetRef.current = serverMs - clientMs;

        if (!mounted) return;
        setIstTime(formatISTFromMs(clientMs + istOffsetRef.current));

        timer = setInterval(() => {
          setIstTime(formatISTFromMs(Date.now() + istOffsetRef.current));
        }, 1000);
      } catch (e) {
        // fallback: keep updating local time (formatted to IST) every second
        setIstTime(localISTFallbackString());
        timer = setInterval(() => setIstTime(localISTFallbackString()), 1000);
      }
    }

    initTime();
    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  // --- Auto-scroll ---
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, busy]);

  // --- API helper ---
  async function apiFetch(path, options = {}) {
    try {
      const res = await fetch(`${apiBase}${path}`, options);
      return await res.json();
    } catch {
      return { error: `❌ Cannot reach ${apiBase}${path}` };
    }
  }

  // --- TTS ---
  function speak(text) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      speechSynthesis.speak(u);
    } catch {
      setSpeaking(false);
    }
  }

  function stopSpeaking() {
    speechSynthesis.cancel();
    setSpeaking(false);
  }

  // --- Extract route (e.g. "from Dubai to Delhi") ---
  function extractRoute(text) {
    const match = text.match(/from\s+([a-zA-Z\s]+)\s+to\s+([a-zA-Z\s]+)/i);
    if (match) {
      return { departure: match[1].trim(), destination: match[2].trim() };
    }
    return null;
  }

  // --- Send message ---
  async function send(text) {
    const content = (text ?? input).trim();
    if (!content) return;

    setInput("");
    setTranscript("");
    const lower = content.toLowerCase();

    // --- TIME/DATE query handling (only time part change) ---
    if (lower.includes("time") || lower.includes("date") || lower.includes("today")) {
      const replyText = `🕒 Current IST: ${istTime}`;
      if (mode === "chat") {
        setMessages((m) => [...m, { role: "assistant", content: replyText }]);
      }
      speak(`The current time in India is ${istTime}`);
      return;
    }

    // ✅ Voyage estimation (SetVoyageEstimation)
    if (
      lower.includes("setvoyageestimation") ||
      lower.includes("voyage estimation") ||
      lower.includes("estimate voyage")
    ) {
      const depMatch = content.match(/from\s+(\w+)/i);
      const destMatch = content.match(/to\s+(\w+)/i);
      const vesselMatch = content.match(/vessel\s+(\w+)/i);
      const cargoMatch = content.match(/carrying\s+(\w+)/i);
      const dateMatch = content.match(/departing on\s+(.+)/i);

      const voyageData = {
        departure: depMatch ? depMatch[1] : null,
        destination: destMatch ? destMatch[1] : null,
        vessel: vesselMatch ? vesselMatch[1] : null,
        cargo: cargoMatch ? cargoMatch[1] : null,
        departureDate: dateMatch ? dateMatch[1] : null,
      };

      setVoyage(voyageData);
      navigate("/navitron");
      return;
    }

    // ✅ Passage planning (SetPassage)
    if (
      lower.includes("setpassage") ||
      lower.includes("passage planning") ||
      lower.includes("plan route")
    ) {
      const route = extractRoute(content);
      if (route) setPassage(route);
      navigate("/passage-planning");
      return;
    }

    // Add user message
    if (mode === "chat") {
      setMessages((m) => [...m, { role: "user", content }]);
      setBusy(true);
    }

    // Fetch reply
    const data = await apiFetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: content }),
    });

    setBusy(false);
    const reply = data?.reply || data?.error || "(no reply)";

    if (mode === "chat") {
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    }

    speak(reply);
  }

  // --- Voice input ---
  function startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("Speech recognition not supported.");
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;

    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);

    rec.onresult = (e) => {
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        setTranscript(t);
      }
      if (finalText) send(finalText);
    };

    rec.start();
  }

  // --- File upload ---
  function handleFile(e, type) {
    const f = e.target.files?.[0];
    if (!f) return;

    setMessages((m) => [...m, { role: "user", content: `📄 Uploading ${f.name}…` }]);

    const form = new FormData();
    form.append("file", f);
    const endpoint = type === "cp" ? "/documents/upload-cp" : "/documents/upload";

    fetch(`${apiBase}${endpoint}`, { method: "POST", body: form })
      .then((res) => res.json())
      .then((data) => {
        if (data?.error) {
          setMessages((m) => [...m, { role: "assistant", content: `❌ ${data.error}` }]);
        } else {
          const summaryText = data?.summary || "(No summary)";
          setMessages((m) => [
            ...m,
            { role: "assistant", content: `✅ ${f.name} uploaded.\n\nSummary:\n${summaryText}` },
          ]);
        }
      });

    if (type === "cp" && cpRef.current) cpRef.current.value = "";
    if (type === "doc" && docRef.current) docRef.current.value = "";
  }

  // --- Chat bubble ---
  function Bubble({ role, content }) {
    const mine = role === "user";
    return (
      <div className={`flex items-start gap-3 ${mine ? "justify-end" : "justify-start"}`}>
        {!mine && <img src={captainImg} alt="Captain" className="w-12 h-12 object-contain" />}
        <div
          className={`max-w-[70%] px-4 py-3 rounded-xl text-[0.95rem] leading-relaxed shadow-sm whitespace-pre-line ${
            mine ? "bg-blue-700 text-white ml-auto" : "bg-gray-100 text-gray-900"
          }`}
        >
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-gray-900 to-blue-900 text-white flex flex-col">
      {/* Header */}
      <div className="max-w-5xl mx-auto w-full px-4 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={captainImg} alt="Captain" className="w-14 h-14 object-contain" />
          <div>
            <h1 className="text-2xl font-bold">Captain Ken</h1>
            <p className="text-sm text-blue-200">Ready to help ⚓</p>
            {/* --- IST display (only time/date change) --- */}
            <p className="text-xs text-blue-200">🕒 IST: {istTime}</p>
          </div>
        </div>
        <input
          value={apiBase}
          onChange={(e) => setApiBase(e.target.value)}
          className="px-3 py-1 rounded-lg bg-gray-800 text-sm border border-gray-700 w-64"
          placeholder="API base URL"
        />
      </div>

      {/* Mode Switch */}
      <div className="max-w-5xl mx-auto w-full px-4 flex gap-3 mb-3">
        <button
          onClick={() => setMode("chat")}
          className={`px-4 py-2 rounded-lg font-medium ${
            mode === "chat" ? "bg-blue-700" : "bg-gray-700 hover:bg-gray-600"
          }`}
        >
          Chat Mode
        </button>
        <button
          onClick={() => setMode("voice")}
          className={`px-4 py-2 rounded-lg font-medium ${
            mode === "voice" ? "bg-blue-700" : "bg-gray-700 hover:bg-gray-600"
          }`}
        >
          Voice Mode
        </button>
      </div>

      {/* Chat Mode */}
      {mode === "chat" && (
        <>
          <div
            ref={chatRef}
            className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-4 overflow-y-auto bg-gray-950/40 rounded-2xl border border-gray-800 shadow-lg"
          >
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} content={m.content} />
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-blue-300 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Captain is thinking...
              </div>
            )}
          </div>

          {/* Input + Uploads */}
          <div className="max-w-5xl mx-auto w-full px-4 py-4 border-t border-gray-800 flex flex-col gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => docRef.current?.click()}
                className="px-3 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 flex items-center gap-2"
              >
                <Upload className="w-5 h-5" /> Upload Document
              </button>
              <input ref={docRef} type="file" onChange={(e) => handleFile(e, "doc")} className="hidden" />

              <button
                onClick={() => cpRef.current?.click()}
                className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 flex items-center gap-2"
              >
                <Upload className="w-5 h-5" /> Upload CP
              </button>
              <input ref={cpRef} type="file" onChange={(e) => handleFile(e, "cp")} className="hidden" />
            </div>

            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Type a message..."
                aria-label="Type your message"
                className="flex-1 px-4 py-2 rounded-lg bg-gray-100 text-gray-900"
              />
              <button
                onClick={() => send()}
                className="p-2 rounded-lg bg-blue-700 hover:bg-blue-800"
                aria-label="Send message"
              >
                <Send className="w-5 h-5" />
              </button>
              <button
                onClick={startListening}
                className={`p-2 rounded-lg ${listening ? "bg-red-600" : "bg-green-600"} hover:opacity-80`}
                aria-label="Start voice input"
              >
                <Mic className="w-5 h-5" />
              </button>
              {/* ✅ Stop button always visible */}
              <button
                onClick={stopSpeaking}
                className="p-2 rounded-lg bg-red-700 hover:bg-red-800"
                aria-label="Stop speaking"
              >
                ⏹
              </button>
            </div>
            {transcript && <p className="text-blue-200 text-sm">🎙 {transcript}</p>}
          </div>
        </>
      )}

      {/* Voice Mode */}
      {mode === "voice" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <img src={captainImg} alt="Captain" className="w-28 h-28 object-contain" />
          <button
            onClick={startListening}
            className={`px-6 py-3 rounded-full font-medium text-lg ${
              listening ? "bg-red-600" : "bg-green-600"
            } hover:opacity-80 flex items-center gap-3`}
          >
            <Mic className="w-6 h-6" /> {listening ? "Listening..." : "Start Talking"}
          </button>
          {/* ✅ Stop button also visible in voice mode */}
          <button
            onClick={stopSpeaking}
            className="px-6 py-3 rounded-full font-medium text-lg bg-red-700 hover:bg-red-800 flex items-center gap-3"
          >
            ⏹ Stop
          </button>
          {transcript && <p className="text-blue-200 text-sm">🎙 {transcript}</p>}
        </div>
      )}
    </div>
  );
}
