import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface LocalQrCodeProps {
  value: string;
  size?: number;
}

export default function LocalQrCode({
  value,
  size = 320,
}: LocalQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      try {
        const next = await QRCode.toDataURL(value, {
          width: size,
          margin: 1,
          errorCorrectionLevel: "M",
          color: {
            dark: "#111827",
            light: "#ffffff",
          },
        });

        if (!cancelled) {
          setDataUrl(next);
        }
      } catch {
        if (!cancelled) {
          setDataUrl("");
        }
      }
    };

    void render();

    return () => {
      cancelled = true;
    };
  }, [size, value]);

  if (!dataUrl) {
    return null;
  }

  return (
    <img
      src={dataUrl}
      alt="QR para ronda de mímica"
      width={size}
      height={size}
    />
  );
}
