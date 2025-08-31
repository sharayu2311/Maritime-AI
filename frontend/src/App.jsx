// src/App.jsx
import { Routes, Route } from "react-router-dom";
import ChatPage from "./ChatPage.jsx";
import PassagePlanningPage from "./PassagePlanningPage.jsx";
import NavitronPage from "./NavitronPage.jsx"; // Voyage Estimation Page

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ChatPage />} />
      <Route path="/passage-planning" element={<PassagePlanningPage />} />
      <Route path="/navitron" element={<NavitronPage />} /> {/* Voyage Estimation */}
    </Routes>
  );
}
