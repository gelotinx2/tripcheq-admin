import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import StopPopup from "./components/StopPopup";
import { useDigitizer } from "./hooks/useDigitizer";

export default function App() {
  const d = useDigitizer();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100">
      <StopPopup {...d.popup} />
      <Sidebar d={d} />
      <MapView containerRef={d.mapContainerRef} />
    </div>
  );
}
