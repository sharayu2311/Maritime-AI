import { createContext, useContext, useState } from "react";

const RouteContext = createContext();

export function RouteProvider({ children }) {
  const [route, setRoute] = useState(null); // {departure, destination}

  return (
    <RouteContext.Provider value={{ route, setRoute }}>
      {children}
    </RouteContext.Provider>
  );
}

export function useRoute() {
  return useContext(RouteContext);
}
