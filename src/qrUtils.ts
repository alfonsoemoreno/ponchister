import QRCode from "qrcode";

export async function generateQRCodeDataURL(text: string): Promise<string> {
  return await QRCode.toDataURL(text, {
    errorCorrectionLevel: "H",
    width: 256,
  });
}
