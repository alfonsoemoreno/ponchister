import { useState } from "react";
import Welcome from "./Welcome";
import QrScanner from "./QrScanner";
import AudioPlayer from "./AudioPlayer";
import AutoGame from "./AutoGame";
import "./App.css";

function App() {
  const [view, setView] = useState<"welcome" | "scan" | "audio" | "auto">(
    "welcome"
  );
  const [videoUrl, setVideoUrl] = useState<string>("");

  const handleAccept = () => setView("scan");
  const handleScan = (url: string) => {
    setVideoUrl(url);
    setView("audio");
  };
  const handleBack = () => {
    setVideoUrl("");
    setView("scan");
  };

  const handleStartAuto = () => setView("auto");
  const handleExitAuto = () => {
    setVideoUrl("");
    setView("welcome");
  };

  if (view === "welcome")
    return <Welcome onAccept={handleAccept} onStartAuto={handleStartAuto} />;
  if (view === "scan") return <QrScanner onScan={handleScan} />;
  if (view === "audio")
    return <AudioPlayer videoUrl={videoUrl} onBack={handleBack} />;
  if (view === "auto") return <AutoGame onExit={handleExitAuto} />;
  return null;
}

export default App;
