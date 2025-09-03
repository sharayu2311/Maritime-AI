// src/PassageContext.jsx
import { createContext, useContext, useState, useMemo } from "react";

const PassageContext = createContext();

export function PassageProvider({ children }) {
  const [departure, setDeparture] = useState(null);
  const [destination, setDestination] = useState(null);
  const [selectedVessel, setSelectedVessel] = useState(null);
  const [selectedCargo, setSelectedCargo] = useState(null);
  const [departureDate, setDepartureDate] = useState(null);

  // Unified voyage object
  const [voyage, setVoyageState] = useState(null);

  // ✅ For PassagePlanningPage
  const setPassage = (route) => {
    if (!route) return;
    if (route.departure) setDeparture(route.departure);
    if (route.destination) setDestination(route.destination);
  };

  // ✅ For NavitronPage (Voyage Estimation)
  const setVoyage = (data) => {
    if (!data) return;

    if (data.departure) setDeparture(data.departure);
    if (data.destination) setDestination(data.destination);
    if (data.vessel) setSelectedVessel(data.vessel);
    if (data.cargo) setSelectedCargo(data.cargo);
    if (data.departureDate) setDepartureDate(data.departureDate);

    setVoyageState({
      departure: data.departure || departure,
      destination: data.destination || destination,
      vessel: data.vessel || selectedVessel,
      cargo: data.cargo || selectedCargo,
      departureDate: data.departureDate || departureDate,
    });
  };

  const value = useMemo(
    () => ({
      departure,
      destination,
      selectedVessel,
      selectedCargo,
      departureDate,
      voyage,
      setDeparture,
      setDestination,
      setSelectedVessel,
      setSelectedCargo,
      setDepartureDate,
      setPassage,   // ✅ added back for PassagePlanningPage
      setVoyage,    // ✅ kept for NavitronPage
    }),
    [departure, destination, selectedVessel, selectedCargo, departureDate, voyage]
  );

  return (
    <PassageContext.Provider value={value}>
      {children}
    </PassageContext.Provider>
  );
}

export function usePassage() {
  return useContext(PassageContext);
}
