// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.jsx";
import { PassageProvider } from "./PassageContext.jsx";

import "./index.css";
import "leaflet/dist/leaflet.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <PassageProvider>
        <App />
      </PassageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
