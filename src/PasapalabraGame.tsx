import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CircularProgress, Dialog, DialogContent, DialogTitle, Tooltip } from "@mui/material";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import HelpOutlineRounded from "@mui/icons-material/HelpOutlineRounded";
import PauseRounded from "@mui/icons-material/PauseRounded";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import SkipNextRounded from "@mui/icons-material/SkipNextRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import MusicNoteRounded from "@mui/icons-material/MusicNoteRounded";
import MicRounded from "@mui/icons-material/MicRounded";
import TimerOutlined from "@mui/icons-material/TimerOutlined";
import HeadphonesRounded from "@mui/icons-material/HeadphonesRounded";
import RecordVoiceOverRounded from "@mui/icons-material/RecordVoiceOverRounded";
import EmojiEventsRounded from "@mui/icons-material/EmojiEventsRounded";
import BlockRounded from "@mui/icons-material/BlockRounded";
import FullscreenRounded from "@mui/icons-material/FullscreenRounded";
import FullscreenExitRounded from "@mui/icons-material/FullscreenExitRounded";
import ListAltRounded from "@mui/icons-material/ListAltRounded";
import HomeRounded from "@mui/icons-material/HomeRounded";
import ErrorOutlineRounded from "@mui/icons-material/ErrorOutlineRounded";
import LoopRounded from "@mui/icons-material/LoopRounded";
import YouTube, { type YouTubeProps } from "react-youtube";
import { extractYoutubeId } from "./lib/autoGameQueue";
import { maskGameMediaSession } from "./lib/gameMediaSession";
import { getRoscoLetters, ROSCO_LANGUAGE_LABELS, nextPendingLetter, type RoscoLanguage, type RoscoQuestion, type RoscoStatus } from "./lib/pasapalabra";
import "./PasapalabraGame.css";

const GAME_SECONDS = 300;
const CLIP_SECONDS = 12;
const statusLabels: Record<RoscoStatus, string> = { pending: "pendiente", correct: "correcta", incorrect: "incorrecta", unavailable: "sin audio" };

// A separate player per letter makes late events and clip timers harmless when
// moving on. The round clock follows loading/buffering rather than iframe load.
function QuestionAudio({ question, paused, concealed, shortcutsEnabled, onLoading, onPlaybackChange, onUnavailableChange }: {
  question: RoscoQuestion;
  paused: boolean;
  concealed: boolean;
  shortcutsEnabled: boolean;
  onLoading: (loading: boolean) => void;
  onPlaybackChange: (playing: boolean) => void;
  onUnavailableChange: (unavailable: boolean) => void;
}) {
  const player = useRef<Parameters<NonNullable<YouTubeProps["onReady"]>>[0]["target"] | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [waiting, setWaiting] = useState(true);
  const [progress, setProgress] = useState(0);
  const mounted = useRef(true);
  const failed = useRef(false);
  const start = Math.max(0, question.song.play_start_seconds || 0);
  const playerOptions = useMemo<YouTubeProps["opts"]>(() => ({
    width: "40", height: "20",
    playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, rel: 0, start, end: start + CLIP_SECONDS },
  }), [start]);
  const fail = useCallback(() => {
    if (!mounted.current) return;
    failed.current = true;
    player.current?.pauseVideo();
    setError(true);
    setWaiting(false);
    setPlaying(false);
    onLoading(true);
    onUnavailableChange(true);
  }, [onLoading, onUnavailableChange]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!waiting) return;
    const timeout = window.setTimeout(fail, 20_000);
    return () => window.clearTimeout(timeout);
  }, [waiting, attempt, fail]);

  useEffect(() => { onPlaybackChange(playing); }, [playing, onPlaybackChange]);

  useEffect(() => {
    if (ready && !failed.current) onLoading(false);
  }, [ready, onLoading]);

  useEffect(() => {
    if (paused) {
      player.current?.pauseVideo();
      setPlaying(false);
    }
  }, [paused]);

  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => {
      const elapsed = Math.max(0, (player.current?.getCurrentTime() ?? start) - start);
      setProgress(Math.min(CLIP_SECONDS, elapsed));
      if (player.current && elapsed >= CLIP_SECONDS) {
        player.current.pauseVideo();
        setPlaying(false);
      }
    }, 150);
    return () => window.clearInterval(interval);
  }, [playing, start]);

  // Detect videos that report playing but never advance.
  useEffect(() => {
    if (!playing || paused) return;
    let lastTime = -1;
    let stalled = 0;
    const interval = window.setInterval(() => {
      const currentTime = player.current?.getCurrentTime() ?? 0;
      stalled = currentTime === lastTime ? stalled + 1 : 0;
      lastTime = currentTime;
      if (stalled >= 15) fail();
    }, 1000);
    return () => window.clearInterval(interval);
  }, [playing, paused, fail]);

  const togglePlayback = useCallback(() => {
    if (!ready || paused || failed.current) return;
    if (playing) { player.current?.pauseVideo(); return; }
    setProgress(0);
    setWaiting(true);
    onLoading(true);
    player.current?.seekTo(start, true);
    player.current?.unMute();
    player.current?.playVideo();
  }, [ready, paused, playing, start, onLoading]);

  useEffect(() => {
    if (!shortcutsEnabled || concealed) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || isTyping(event.target) ||
          (event.target instanceof HTMLElement && event.target.closest("button"))) return;
      event.preventDefault();
      togglePlayback();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcutsEnabled, concealed, togglePlayback]);

  return <div className={`pasapalabra-audio ${concealed ? "concealed" : ""}`}>
    <div aria-hidden="true" className="pasapalabra-player">
      <YouTube key={attempt} videoId={extractYoutubeId(question.song.youtube_url) ?? ""}
        title="Audio del desafío musical" opts={playerOptions}
        onReady={event => {
          if (!mounted.current || failed.current) { event.target.pauseVideo(); return; }
          player.current = event.target;
          setWaiting(false);
          setReady(true);
          maskGameMediaSession("paused");
        }}
        onError={event => { console.warn("[pasapalabra] Error de reproducción", event.data); fail(); }}
        onStateChange={event => {
          if (!mounted.current || failed.current) return;
          if (paused && event.data === 1) { event.target.pauseVideo(); return; }
          if (event.data === 1) { setWaiting(false); setPlaying(true); onLoading(false); maskGameMediaSession("playing"); }
          if (event.data === 3) { setWaiting(true); onLoading(true); }
          if (event.data === 0) setProgress(CLIP_SECONDS);
          if (event.data === 0 || event.data === 2) { setWaiting(false); setPlaying(false); onLoading(false); maskGameMediaSession("paused"); }
        }} />
    </div>
    {error ? <div className="pasapalabra-audio-error" role="alert">
      <ErrorOutlineRounded /><span>Audio no disponible</span>
      <Control label="Reintentar audio" onClick={() => {
        failed.current = false;
        setWaiting(true);
        player.current = null;
        setReady(false);
        setError(false);
        onUnavailableChange(false);
        onLoading(true);
        setAttempt(a => a + 1);
      }}><RefreshRounded /></Control>
    </div> : <>
      <div className={`pasapalabra-audio-orbit ${playing ? "playing" : ""}`}>
        <Control className="pasapalabra-play" label={playing ? "Detener fragmento · Espacio" : "Escuchar 12 segundos · Espacio"}
          disabled={!ready || paused || (waiting && !playing)} onClick={togglePlayback}>
          {!ready || (waiting && !playing) ? <CircularProgress size={30} color="inherit" /> : playing ? <PauseRounded /> : <PlayArrowRounded />}
        </Control>
      </div>
      <div className="pasapalabra-clip">
        <HeadphonesRounded />
        <span>{!ready ? "Preparando audio" : waiting ? "Cargando…" : playing ? "Escuchando" : progress > 0 ? "Volver a escuchar" : "Escucha la pista"}</span>
        <b>{Math.floor(progress).toString().padStart(2, "0")} / 12 s</b>
      </div>
      <div className="pasapalabra-clip-track" role="progressbar" aria-label="Fragmento reproducido" aria-valuemin={0} aria-valuemax={12} aria-valuenow={Math.floor(progress)}>
        <span style={{ width: `${progress / CLIP_SECONDS * 100}%` }} />
      </div>
    </>}
  </div>;
}

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable=true]"));
}

function Control({ label, children, onClick, disabled = false, className = "" }: {
  label: string; children: ReactNode; onClick: () => void; disabled?: boolean; className?: string;
}) {
  return <Tooltip title={label} arrow enterDelay={350}>
    <span className="pasapalabra-control-wrap"><button type="button" className={`pasapalabra-control ${className}`} aria-label={label}
      disabled={disabled} onClick={onClick}>{children}</button></span>
  </Tooltip>;
}

function Waveform({ active = false }: { active?: boolean }) {
  return <div className={`pasapalabra-wave ${active ? "active" : ""}`} aria-hidden="true">
    {[12, 20, 32, 18, 40, 28, 46, 22, 34, 46, 28, 40, 18, 32, 20, 12].map((height, i) =>
      <i key={i} style={{ "--bar-height": `${height}px`, "--bar-delay": `${i * -0.11}s` } as CSSProperties} />)}
  </div>;
}

export default function PasapalabraGame({ onExit }: { onExit: () => void }) {
  const [questions, setQuestions] = useState<RoscoQuestion[]>([]);
  const [statuses, setStatuses] = useState<RoscoStatus[]>([]);
  const [current, setCurrent] = useState(0);
  const [phase, setPhase] = useState<"setup" | "playing" | "finished">("setup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState<RoscoLanguage>("all");
  const request = useRef<AbortController | null>(null);
  const [remaining, setRemaining] = useState(GAME_SECONDS * 1000);
  const [paused, setPaused] = useState(false);
  const [audioLoading, setAudioLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewPage, setReviewPage] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [passed, setPassed] = useState<Set<string>>(new Set());
  const [fullscreen, setFullscreen] = useState(false);
  const question = questions[current];

  useEffect(() => () => request.current?.abort(), []);

  const startRosco = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/songs/pasapalabra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json() as { questions: RoscoQuestion[] };
      if (controller.signal.aborted) return;
      setQuestions(data.questions);
      setStatuses(data.questions.map(() => "pending"));
      setCurrent(0);
      setRemaining(GAME_SECONDS * 1000);
      setPaused(false);
      setRevealed(false);
      setAudioLoading(true);
      setAudioError(false);
      setAudioPlaying(false);
      setPassed(new Set());
      setPhase("playing");
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "No se pudo cargar el rosco.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [language]);

  const clockRunning = phase === "playing" && !paused && !audioLoading && !revealed && !exitOpen && !helpOpen;
  useEffect(() => {
    if (!clockRunning) return;
    let last = performance.now();
    const interval = window.setInterval(() => {
      const now = performance.now();
      const elapsed = now - last;
      last = now;
      setRemaining(value => Math.max(0, value - elapsed));
    }, 100);
    return () => window.clearInterval(interval);
  }, [clockRunning]);
  useEffect(() => {
    if (remaining === 0 && phase === "playing") setPhase("finished");
  }, [remaining, phase]);
  useEffect(() => () => maskGameMediaSession("none"), []);

  const advance = useCallback((status: RoscoStatus) => {
    const next = [...statuses];
    next[current] = status;
    setStatuses(next);
    const index = nextPendingLetter(next, current);
    setRevealed(false);
    if (status === "pending") setPassed(previous => new Set(previous).add(questions[current].letter));
    setAudioPlaying(false);
    if (index === -1) { setPhase("finished"); return; }
    if (index !== current) { setAudioLoading(true); setAudioError(false); }
    setCurrent(index);
  }, [current, questions, statuses]);
  const seconds = Math.ceil(remaining / 1000);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const displayLetters = phase === "setup" ? getRoscoLetters(language) : questions.map(question => question.letter);
  const totalLetters = displayLetters.length;
  const correct = phase === "setup" ? 0 : statuses.filter(s => s === "correct").length;
  const incorrect = phase === "setup" ? 0 : statuses.filter(s => s === "incorrect").length;

  const pending = phase === "setup" ? totalLetters : statuses.filter(s => s === "pending").length;
  const unavailable = statuses.filter(s => s === "unavailable").length;
  const completed = totalLetters - pending;
  const dialogsOpen = helpOpen || exitOpen || reviewOpen;

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    if (phase !== "playing" || dialogsOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || isTyping(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "Escape") { event.preventDefault(); setPaused(value => !value); return; }
      if (paused) return;
      if (event.key === "ArrowRight" && !revealed) { event.preventDefault(); advance("pending"); }
      if (event.key === "Enter" && !(event.target instanceof HTMLElement && event.target.closest("button"))) {
        event.preventDefault();
        if (revealed) advance("correct");
        else if (!audioLoading) setRevealed(true);
      }
      if (event.key === "Backspace" && revealed) { event.preventDefault(); advance("incorrect"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, dialogsOpen, paused, revealed, audioLoading, advance]);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* Fullscreen is optional; the stage also fits the normal viewport. */ }
  }

  const newRosco = () => {
    setLoading(false);
    setError("");
    setRemaining(GAME_SECONDS * 1000);
    setPhase("setup");
    setReviewOpen(false);
    setReviewPage(0);
    setPassed(new Set());
  };
  const reviewItems = questions.slice(reviewPage * 6, reviewPage * 6 + 6);
  const reviewPages = Math.ceil(questions.length / 6);

  return <main className={`pasapalabra ${audioPlaying ? "is-listening" : ""} ${phase === "finished" ? "is-finished" : ""}`}>
    <div className="pasapalabra-lights" aria-hidden="true" />
    <div className="pasapalabra-shell">
      <header className="pasapalabra-header">
        <div className="pasapalabra-brand">
          <Control label="Volver al inicio" onClick={() => phase === "playing" ? setExitOpen(true) : onExit()}><ArrowBackRounded /></Control>
          <img src="/ponchister_ico.png" alt="Ponchister" width="40" height="40" />
          <div><h1>Pasapalabra<span>musical</span></h1><p>ARTISTAS + CANCIONES</p></div>
        </div>
        <div className={`pasapalabra-clock ${seconds <= 30 ? "urgent" : ""} ${!clockRunning && phase === "playing" ? "stopped" : ""}`}>
          <TimerOutlined /><strong role="timer" aria-label={`Tiempo restante: ${time}`}>{time}</strong>
          {phase === "playing" && <span className="pasapalabra-clock-state" aria-label={clockRunning ? "Reloj en marcha" : "Reloj en pausa"}>
            {clockRunning ? <span className="pasapalabra-live-dot" /> : <PauseRounded />}
          </span>}
        </div>
        <nav className="pasapalabra-utilities" aria-label="Controles de la partida">
          {phase === "playing" && <Control label={paused ? "Continuar partida · Esc" : "Pausar partida · Esc"} onClick={() => setPaused(v => !v)}>
            {paused ? <PlayArrowRounded /> : <PauseRounded />}
          </Control>}
          <Control label="Cómo jugar" onClick={() => setHelpOpen(true)}><HelpOutlineRounded /></Control>
          <Control label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"} onClick={() => void toggleFullscreen()}>
            {fullscreen ? <FullscreenExitRounded /> : <FullscreenRounded />}
          </Control>
        </nav>
      </header>

      {loading || error ? <section className="pasapalabra-loading" aria-live="polite">
        {error ? <><ErrorOutlineRounded /><h2>No pudimos preparar el rosco</h2><p>{error}</p>
          <button className="pasapalabra-button primary" onClick={() => void startRosco()}><RefreshRounded />Reintentar</button>
          <button className="pasapalabra-button secondary" onClick={() => setError("")}><ArrowBackRounded />Cambiar idioma</button></>
          : <><div className="pasapalabra-loading-ring"><MusicNoteRounded /></div><h2>Preparando el escenario</h2><p>Buscando las {getRoscoLetters(language).length} letras…</p></>}
      </section> : <>
        <div className="pasapalabra-stage">
          <section className="pasapalabra-arena" aria-label="Rosco musical">
            <div className="pasapalabra-stage-label"><span /> EL ROSCO MUSICAL <span /></div>
            <div className="pasapalabra-ring-space">
              <div className="pasapalabra-rosco" aria-label="Rosco de letras">
                <div className="pasapalabra-ring-track" aria-hidden="true" />
                {displayLetters.map((letter, index) => {
                  const status = phase === "setup" ? "pending" : statuses[index];
                  const angle = (index / totalLetters) * Math.PI * 2 - Math.PI / 2;
                  const isCurrent = phase === "playing" && current === index;
                  return <div key={letter}
                    className={`pasapalabra-letter ${status} ${passed.has(letter) && status === "pending" ? "passed" : ""} ${isCurrent ? "active" : ""}`}
                    style={{ left: `${50 + 44 * Math.cos(angle)}%`, top: `${50 + 44 * Math.sin(angle)}%` }}
                    aria-current={isCurrent ? "step" : undefined}
                    aria-label={`${letter}: ${statusLabels[status]}${isCurrent ? ", actual" : ""}`}>
                    <span>{letter}</span>
                    {status === "correct" ? <CheckRounded /> : status === "incorrect" ? <CloseRounded /> : status === "unavailable" ? <BlockRounded /> : null}
                  </div>;
                })}
                <div className={`pasapalabra-center ${paused ? "paused" : ""}`} aria-live="polite">
                  {phase === "setup" ? <>
                    <div className="pasapalabra-center-kicker">EL DESAFÍO</div>
                    <strong className="pasapalabra-center-number">{totalLetters}</strong>
                    <span className="pasapalabra-center-caption">letras por descubrir</span>
                    <Waveform />
                  </> : phase === "finished" ? <>
                    <EmojiEventsRounded className="pasapalabra-trophy" />
                    <strong className="pasapalabra-center-number">{correct}<small>/{questions.length}</small></strong>
                    <span className="pasapalabra-center-caption">aciertos</span>
                  </> : paused ? <>
                    <PauseRounded className="pasapalabra-pause-symbol" /><span className="pasapalabra-center-caption">En pausa</span>
                  </> : <>
                    <span className="pasapalabra-center-kicker">{question?.rule === "starts" ? "EMPIEZA CON" : "CONTIENE"}</span>
                    <strong className="pasapalabra-current-letter" key={question?.letter}>{question?.letter}</strong>
                    <span className="pasapalabra-kind">{question?.kind === "artist" ? <MicRounded /> : <MusicNoteRounded />}{question?.kind === "artist" ? "ARTISTA" : "CANCIÓN"}</span>
                    <Waveform active={audioPlaying} />
                  </>}
                </div>
              </div>
            </div>
            <div className="pasapalabra-legend" aria-label="Estados de las letras">
              <span><i className="correct" />Acierto</span><span><i className="incorrect" />Error</span><span><i className="passed" />Pasapalabra</span>
            </div>
          </section>

          <aside className="pasapalabra-console" aria-label="Panel de juego">
            <div className="pasapalabra-scoreboard" aria-label="Marcador">
              <div className="correct" title="Aciertos"><CheckRounded /><strong>{correct.toString().padStart(2, "0")}</strong><span>Aciertos</span></div>
              <div className="incorrect" title="Errores"><CloseRounded /><strong>{incorrect.toString().padStart(2, "0")}</strong><span>Errores</span></div>
              <div className="pending" title="Pendientes"><LoopRounded /><strong>{pending.toString().padStart(2, "0")}</strong><span>Pendientes</span></div>
            </div>
            <section className={`pasapalabra-panel ${revealed ? "answer-visible" : ""}`}>
              {phase === "setup" && <>
                <span className="pasapalabra-eyebrow">¿LISTOS?</span>
                <h2>Completa<br /> el rosco<span>.</span></h2>
                <div className="pasapalabra-how">
                  <div><HeadphonesRounded /><span>Escucha 12 segundos</span></div>
                  <div><RecordVoiceOverRounded /><span>Responde en voz alta</span></div>
                  <div><LoopRounded /><span>Pasa y vuelve después</span></div>
                </div>
                <div className="pasapalabra-languages" role="group" aria-label="Idioma de las canciones">
                  {(["all", "espanol", "ingles"] as const).map(value => <button key={value} type="button"
                    aria-pressed={language === value} onClick={() => setLanguage(value)}>{ROSCO_LANGUAGE_LABELS[value]}</button>)}
                </div>
                <button className="pasapalabra-button primary" onClick={() => void startRosco()}><PlayArrowRounded />¡A jugar!</button>
                <span className="pasapalabra-panel-footnote">5 minutos · {totalLetters} letras</span>
              </>}
              {phase === "playing" && question && <>
                <div className="pasapalabra-question-heading">
                  <span className="pasapalabra-eyebrow">{revealed ? "LA RESPUESTA" : "AFINA EL OÍDO"}</span>
                  {!revealed && <h2>{question.kind === "artist" ? "¿Quién suena?" : "¿Qué canción es?"}</h2>}
                </div>
                <QuestionAudio key={question.letter} question={question} paused={paused || revealed || dialogsOpen}
                  concealed={revealed} shortcutsEnabled={!dialogsOpen} onLoading={setAudioLoading}
                  onPlaybackChange={setAudioPlaying} onUnavailableChange={setAudioError} />
                {revealed ? <div className="pasapalabra-answer" aria-live="polite">
                  <div className="pasapalabra-answer-kind">{question.kind === "artist" ? <MicRounded /> : <MusicNoteRounded />}{question.kind === "artist" ? "Artista" : "Canción"}</div>
                  <h2 className={question.song[question.kind].length > 45 ? "long-answer" : ""}>{question.song[question.kind]}</h2>
                  <p title={question.kind === "artist" ? question.song.title : question.song.artist}>{question.kind === "artist" ? question.song.title : question.song.artist}</p>
                  <div className="pasapalabra-verdict">
                    <Control className="verdict-correct" label="Correcta · Enter" disabled={paused} onClick={() => advance("correct")}><CheckRounded /></Control>
                    <Control className="verdict-incorrect" label="Incorrecta · Retroceso" disabled={paused} onClick={() => advance("incorrect")}><CloseRounded /></Control>
                  </div>
                  <span className="pasapalabra-panel-footnote">¿Acertó?</span>
                </div> : <div className="pasapalabra-actions">
                  <button className="pasapalabra-button secondary" disabled={paused || audioLoading} onClick={() => setRevealed(true)} title="Ver respuesta · Enter"><VisibilityRounded /><span>Revelar</span></button>
                  <button className="pasapalabra-button pass" disabled={paused} onClick={() => advance("pending")} title="Pasapalabra · Flecha derecha"><SkipNextRounded /><span>Pasapalabra</span></button>
                </div>}
                {audioError && !revealed && <button className="pasapalabra-button quiet" disabled={paused} onClick={() => advance("unavailable")}><BlockRounded />Anular letra</button>}
                <div className="pasapalabra-panel-status" aria-live="polite">
                  <span className={paused || revealed ? "amber" : ""} />
                  {paused ? "Partida en pausa" : revealed ? "Reloj en pausa · Valida la respuesta" : audioLoading ? "Reloj en pausa · Cargando audio" : "El tiempo corre"}
                </div>
              </>}
              {phase === "finished" && <>
                <span className="pasapalabra-eyebrow">{remaining === 0 ? "TIEMPO CUMPLIDO" : "DESAFÍO COMPLETADO"}</span>
                <h2>{correct === questions.length ? "¡Rosco perfecto!" : "¡Bien jugado!"}</h2>
                <div className="pasapalabra-final-stats">
                  <span><TimerOutlined />{Math.floor((GAME_SECONDS * 1000 - remaining) / 60000)}:{String(Math.floor((GAME_SECONDS * 1000 - remaining) / 1000) % 60).padStart(2, "0")}<small>jugados</small></span>
                  <span><BlockRounded />{unavailable}<small>anuladas</small></span>
                </div>
                <button className="pasapalabra-button primary" onClick={newRosco}><RefreshRounded />Otro rosco</button>
                <button className="pasapalabra-button secondary" onClick={() => { setReviewPage(0); setReviewOpen(true); }}><ListAltRounded />Respuestas</button>
              </>}
            </section>

          </aside>
        </div>
        <footer className="pasapalabra-footer">
          <span className="pasapalabra-progress-label">{completed}<span> / {totalLetters}</span></span>
          <div className="pasapalabra-round-track" role="progressbar" aria-label="Letras resueltas" aria-valuemin={0} aria-valuemax={totalLetters} aria-valuenow={completed}>
            <span style={{ width: `${completed / totalLetters * 100}%` }} />
          </div>
          <span className="pasapalabra-footer-note">{`${ROSCO_LANGUAGE_LABELS[language]} · ARTISTAS + CANCIONES`}</span>
        </footer>
      </>}
    </div>

    <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} slotProps={{ paper: { className: "pasapalabra-dialog" } }} aria-labelledby="rosco-help-title">
      <DialogTitle id="rosco-help-title"><HelpOutlineRounded />Cómo jugar<Control label="Cerrar ayuda" onClick={() => setHelpOpen(false)}><CloseRounded /></Control></DialogTitle>
      <DialogContent>
        <div className="pasapalabra-help-steps">
          <p><HeadphonesRounded /><span>Escucha el fragmento. La letra pide un <b>artista</b> o una <b>canción</b>.</span></p>
          <p><RecordVoiceOverRounded /><span>Responde en voz alta. Quien dirige revela y marca <b>✓</b> o <b>✕</b>.</span></p>
          <p><LoopRounded /><span>Di <b>Pasapalabra</b> para volver a esa letra en la siguiente vuelta.</span></p>
        </div>
        <p className="pasapalabra-help-note">5 minutos efectivos. El reloj se pausa durante cargas, al validar respuestas y con el botón de pausa. «Contiene» permite respuestas con esa letra en cualquier posición.</p>
        <div className="pasapalabra-shortcuts"><span><kbd>Espacio</kbd>Audio</span><span><kbd>→</kbd>Pasar</span><span><kbd>Enter</kbd>Revelar / ✓</span><span><kbd>⌫</kbd>✕</span><span><kbd>Esc</kbd>Pausa</span></div>
      </DialogContent>
    </Dialog>
    <Dialog open={exitOpen} onClose={() => setExitOpen(false)} slotProps={{ paper: { className: "pasapalabra-dialog" } }} aria-labelledby="rosco-exit-title">
      <DialogTitle id="rosco-exit-title">¿Salir del rosco?</DialogTitle>
      <DialogContent><p>Se perderá el progreso de esta partida.</p><div className="pasapalabra-actions">
        <button className="pasapalabra-button secondary" onClick={() => setExitOpen(false)}><PlayArrowRounded />Continuar</button>
        <button className="pasapalabra-button primary" onClick={onExit}><HomeRounded />Salir</button>
      </div></DialogContent>
    </Dialog>
    <Dialog open={reviewOpen} onClose={() => setReviewOpen(false)} maxWidth="md" fullWidth slotProps={{ paper: { className: "pasapalabra-dialog" } }} aria-labelledby="rosco-review-title">
      <DialogTitle id="rosco-review-title"><ListAltRounded />Las respuestas<Control label="Cerrar respuestas" onClick={() => setReviewOpen(false)}><CloseRounded /></Control></DialogTitle>
      <DialogContent>
        <div className="pasapalabra-review">{reviewItems.map(item => {
          const status = statuses[questions.indexOf(item)];
          return <div key={item.letter} className={status}>
            <span className="pasapalabra-review-letter" aria-label={`${item.letter}: ${statusLabels[status]}`}>{item.letter}</span>
            <div><span>{item.kind === "artist" ? <MicRounded /> : <MusicNoteRounded />}{statusLabels[status]}</span><strong>{item.song[item.kind]}</strong><small>{item.kind === "artist" ? item.song.title : item.song.artist}</small></div>
          </div>;
        })}</div>
        <div className="pasapalabra-review-pages">
          <Control label="Página anterior" disabled={reviewPage === 0} onClick={() => setReviewPage(p => p - 1)}><ArrowBackRounded /></Control>
          <span>{reviewPage + 1} / {reviewPages}</span>
          <Control label="Página siguiente" disabled={reviewPage + 1 >= reviewPages} onClick={() => setReviewPage(p => p + 1)}><ArrowForwardRounded /></Control>
        </div>
      </DialogContent>
    </Dialog>
  </main>;
}
