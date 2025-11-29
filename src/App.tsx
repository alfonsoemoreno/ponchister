import { useState } from "react";
import Welcome from "./Welcome";
import QrScanner from "./QrScanner";
import AudioPlayer from "./AudioPlayer";
import AutoGame from "./AutoGame";
import BingoGame from "./BingoGame";
import "./App.css";

function App() {
  const [view, setView] = useState<
    "welcome" | "scan" | "audio" | "auto" | "bingo"
  >("welcome");
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

  const handleStartBingo = () => setView("bingo");
  const handleExitBingo = () => {
    setVideoUrl("");
    setView("welcome");
  };

  if (view === "welcome")
    return (
      <Welcome
        onAccept={handleAccept}
        onStartAuto={handleStartAuto}
        onStartBingo={handleStartBingo}
      />
    );
  if (view === "scan") return <QrScanner onScan={handleScan} />;
  if (view === "audio")
    return <AudioPlayer videoUrl={videoUrl} onBack={handleBack} />;
  if (view === "auto") return <AutoGame onExit={handleExitAuto} />;
  if (view === "bingo") return <BingoGame onExit={handleExitBingo} />;
  return null;
}

export default App;
