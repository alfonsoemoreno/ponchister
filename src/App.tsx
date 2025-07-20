import { useState } from "react";
import Welcome from "./Welcome";
import QrScanner from "./QrScanner";
import AudioPlayer from "./AudioPlayer";
import "./App.css";

function App() {
  const [view, setView] = useState<"welcome" | "scan" | "audio">("welcome");
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

  if (view === "welcome") return <Welcome onAccept={handleAccept} />;
  if (view === "scan") return <QrScanner onScan={handleScan} />;
  if (view === "audio")
    return <AudioPlayer videoUrl={videoUrl} onBack={handleBack} />;
  return null;
}

export default App;
