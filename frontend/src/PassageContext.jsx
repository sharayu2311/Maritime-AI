export function PassageProvider({ children }) {
  const [departure, setDeparture] = useState(null);
  const [destination, setDestination] = useState(null);
  const [selectedVessel, setSelectedVessel] = useState(null);
  const [selectedCargo, setSelectedCargo] = useState(null);
  const [voyage, setVoyageState] = useState(null); // ✅ add voyage object

  const setVoyage = (data) => {
    if (!data) return;

    let dep = data.departure;
    let dest = data.destination;
    let vessel = data.vessel;
    let cargo = data.cargo;

    if (typeof dep === "string") dep = findPortByName(dep);
    if (typeof dest === "string") dest = findPortByName(dest);
    if (typeof vessel === "string") vessel = findVesselByName(vessel);
    if (typeof cargo === "string") cargo = findCargoByName(cargo);

    if (dep) setDeparture(dep);
    if (dest) setDestination(dest);
    if (vessel) setSelectedVessel(vessel);
    if (cargo) setSelectedCargo(cargo);

    // ✅ keep voyage object
    setVoyageState({
      departure: dep,
      destination: dest,
      vessel,
      cargo,
      departureDate: data.departureDate || null,
    });
  };

  const value = useMemo(
    () => ({
      departure,
      destination,
      selectedVessel,
      selectedCargo,
      voyage,              // ✅ expose voyage
      setDeparture,
      setDestination,
      setSelectedVessel,
      setSelectedCargo,
      setPassage,
      setVoyage,
      ports,
      vessels,
      cargoes,
    }),
    [departure, destination, selectedVessel, selectedCargo, voyage]
  );

  return (
    <PassageContext.Provider value={value}>{children}</PassageContext.Provider>
  );
}
