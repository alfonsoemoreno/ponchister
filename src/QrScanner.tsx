import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QrScannerProps {
  onScan: (url: string) => void;
}

const QrScanner: React.FC<QrScannerProps> = ({ onScan }) => {
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scannerId = "qr-scanner";
    let cleanupDiv: HTMLDivElement | null = null;
    let html5QrCodeInstance: Html5Qrcode | null = null;
    if (scannerRef.current) {
      cleanupDiv = scannerRef.current;
      cleanupDiv.innerHTML = "";
      cleanupDiv.id = scannerId;
      html5QrCodeInstance = new Html5Qrcode(scannerId);
      html5QrCodeRef.current = html5QrCodeInstance;
      html5QrCodeInstance
        .start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: window.innerWidth, height: window.innerHeight },
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore: focusMode es experimental y no está en los tipos oficiales
            focusMode: "continuous",
          },
          (decodedText) => {
            if (decodedText.startsWith("http")) {
              if (html5QrCodeInstance && html5QrCodeInstance.isScanning) {
                html5QrCodeInstance.stop().catch(() => {});
              }
              onScan(decodedText);
            }
          },
          () => {}
        )
        .catch(() => {
          setError(
            "No se pudo acceder a la cámara. Por favor revisa los permisos o prueba en un dispositivo con cámara."
          );
        });
    }
    // Evento para forzar autofocus en móviles
    const handleTouch = () => {
      if (scannerRef.current) {
        // El navegador intentará enfocar al tocar el video
        const video = scannerRef.current.querySelector("video");
        if (video) {
          video.focus();
        }
      }
    };
    window.addEventListener("touchend", handleTouch);
    return () => {
      if (html5QrCodeInstance && html5QrCodeInstance.isScanning) {
        html5QrCodeInstance.stop().catch(() => {});
      }
      if (cleanupDiv) {
        cleanupDiv.innerHTML = "";
      }
      html5QrCodeRef.current = null;
      window.removeEventListener("touchend", handleTouch);
    };
  }, [onScan]);

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center bg-dark"
      style={{ zIndex: 1000 }}
    >
      {error ? (
        <div
          className="alert alert-danger position-absolute top-0 w-100 text-center"
          style={{ zIndex: 1100 }}
        >
          {error}
        </div>
      ) : null}
      {/* Fondo negro */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "#000",
          zIndex: 0,
        }}
      />
      {/* Marco visual cuadrado */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "60vw",
          height: "60vw",
          maxWidth: 340,
          maxHeight: 340,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            borderRadius: 24,
            border: "4px solid #00e6ff",
            boxShadow: "0 0 32px #00e6ff, 0 0 64px #00e6ff",
            boxSizing: "border-box",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
        {/* Esquinas decorativas */}
        <div
          style={{
            position: "absolute",
            top: -4,
            left: -4,
            width: 32,
            height: 32,
            borderTop: "4px solid #fff",
            borderLeft: "4px solid #fff",
            borderRadius: "24px 0 0 0",
            boxSizing: "border-box",
            zIndex: 3,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            width: 32,
            height: 32,
            borderTop: "4px solid #fff",
            borderRight: "4px solid #fff",
            borderRadius: "0 24px 0 0",
            boxSizing: "border-box",
            zIndex: 3,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -4,
            left: -4,
            width: 32,
            height: 32,
            borderBottom: "4px solid #fff",
            borderLeft: "4px solid #fff",
            borderRadius: "0 0 0 24px",
            boxSizing: "border-box",
            zIndex: 3,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -4,
            right: -4,
            width: 32,
            height: 32,
            borderBottom: "4px solid #fff",
            borderRight: "4px solid #fff",
            borderRadius: "0 0 24px 0",
            boxSizing: "border-box",
            zIndex: 3,
          }}
        />
      </div>
      {/* Cámara con zoom dentro del marco */}
      <div
        id="qr-scanner"
        ref={scannerRef}
        key={error ? "error" : "scanner"}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "60vw",
          height: "60vw",
          maxWidth: 340,
          maxHeight: 340,
          transform: "translate(-50%, -50%) scale(1.8)", // zoom 80%
          objectFit: "cover",
          margin: 0,
          padding: 0,
          border: "none",
          borderRadius: 16,
          overflow: "hidden",
          background: "#000",
          boxShadow: "0 0 32px #000",
          zIndex: 1,
        }}
      />
      {/* Mensaje para forzar enfoque */}
      {/* <div
        style={{
          position: "absolute",
          bottom: 32,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.7)",
          color: "#fff",
          padding: "8px 20px",
          borderRadius: 16,
          fontSize: 18,
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        Toca la pantalla para enfocar si la imagen está borrosa
      </div> */}
    </div>
  );
};

export default QrScanner;
