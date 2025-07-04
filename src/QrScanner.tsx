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
          { fps: 10, qrbox: 250 },
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
    return () => {
      if (html5QrCodeInstance && html5QrCodeInstance.isScanning) {
        html5QrCodeInstance.stop().catch(() => {});
      }
      if (cleanupDiv) {
        cleanupDiv.innerHTML = "";
      }
      html5QrCodeRef.current = null;
    };
  }, [onScan]);

  return (
    <div className="d-flex flex-column justify-content-center align-items-center vh-100 bg-light">
      <div className="card p-4 shadow-lg text-center">
        <h2 className="mb-3">Escanea un código QR de YouTube</h2>
        {error ? (
          <div className="alert alert-danger">{error}</div>
        ) : (
          <div
            id="qr-scanner"
            ref={scannerRef}
            key={error ? "error" : "scanner"}
            style={{ width: 300, height: 300 }}
          />
        )}
      </div>
    </div>
  );
};

export default QrScanner;
