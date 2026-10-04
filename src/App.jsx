import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import StopPopup from "./components/StopPopup";
import { useDigitizer } from "./hooks/useDigitizer";
import { useEffect, useState } from "react";

export default function App() {
  // Initialize state from localStorage or default to false (light mode)
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });
  const d = useDigitizer({ darkMode });

  // Sync state with HTML document class list and localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
      <StopPopup {...d.popup} />
      <Sidebar d={d} darkMode={darkMode} setDarkMode={setDarkMode} />
      <MapView containerRef={d.mapContainerRef} />
    </div>
  );
}
