import { useState } from "react";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { generateQRCodeDataURL } from "./qrUtils";
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DownloadIcon from "@mui/icons-material/Download";
import MusicNoteIcon from "@mui/icons-material/MusicNote";

interface ExcelRow {
  ARTISTA: string;
  CANCION: string;
  LANZAMIENTO: string | number;
  YOUTUBE: string;
}

const CARD_SIZE = 48; // mm (ajustado para 4x4 en carta)
const CARDS_PER_ROW = 4;
const CARDS_PER_COL = 4;
const PAGE_WIDTH = 215.9; // mm (8.5in)
const PAGE_HEIGHT = 279.4; // mm (11in)
const GAP = 4; // espacio entre tarjetas
const totalWidth = CARDS_PER_ROW * CARD_SIZE + (CARDS_PER_ROW - 1) * GAP;
const totalHeight = CARDS_PER_COL * CARD_SIZE + (CARDS_PER_COL - 1) * GAP;
const MARGIN_X = (PAGE_WIDTH - totalWidth) / 2;
const MARGIN_Y = (PAGE_HEIGHT - totalHeight) / 2;

// Sample sheet configuration: 5 columns x 4 rows for 20 cards
const SAMPLE_COLS = 5;
const SAMPLE_ROWS = 5; // 5 rows for 25 cards
const SHEET_MARGIN = 10; // page margin in mm
// calculate card size to avoid cutting at edges
const SAMPLE_CARD_SIZE =
  (PAGE_WIDTH - 2 * SHEET_MARGIN - (SAMPLE_COLS - 1) * GAP) / SAMPLE_COLS;
const SAMPLE_MARGIN_X = SHEET_MARGIN;
// center vertically
const SAMPLE_MARGIN_Y =
  (PAGE_HEIGHT - (SAMPLE_ROWS * SAMPLE_CARD_SIZE + (SAMPLE_ROWS - 1) * GAP)) /
  2;
// Placeholder for logo image (base64 Data URL), replace with your own
const logoDataUrl = "DATA_URL_OF_YOUR_LOGO_HERE"; // must be PNG or JPEG

async function generatePDF(rows: ExcelRow[]) {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const cardsPerPage = CARDS_PER_ROW * CARDS_PER_COL;
  const totalCards = rows.length;
  const totalPages = Math.ceil(totalCards / cardsPerPage);

  // 1. Print data cards with numbers
  let cardNumber = 1;
  for (let page = 0; page < totalPages; page++) {
    if (page > 0) doc.addPage();
    for (let i = 0; i < cardsPerPage; i++) {
      const idx = page * cardsPerPage + i;
      if (idx >= totalCards) break;
      const rowPos = Math.floor(i / CARDS_PER_ROW);
      const colPos = i % CARDS_PER_ROW;
      const x = MARGIN_X + colPos * (CARD_SIZE + GAP);
      const y = MARGIN_Y + rowPos * (CARD_SIZE + GAP);
      doc.setDrawColor(0);
      doc.rect(x, y, CARD_SIZE, CARD_SIZE);
      // Card number
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(String(cardNumber), x + 2, y + 3);
      // Song title
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      const cancionLines = doc.splitTextToSize(
        rows[idx].CANCION,
        CARD_SIZE - 8
      );
      doc.text(cancionLines, x + CARD_SIZE / 2, y + 7, {
        align: "center",
        baseline: "top",
      });
      // Year
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text(
        String(rows[idx].LANZAMIENTO),
        x + CARD_SIZE / 2,
        y + CARD_SIZE / 2,
        {
          align: "center",
          baseline: "middle",
        }
      );
      // Artist
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      const artistaLines = doc.splitTextToSize(
        rows[idx].ARTISTA,
        CARD_SIZE - 8
      );
      const lineHeight = 5.5;
      const startY =
        y + CARD_SIZE - 10 - (artistaLines.length - 1) * lineHeight;
      doc.text(artistaLines, x + CARD_SIZE / 2, startY, {
        align: "center",
        baseline: "top",
      });
      cardNumber++;
    }
  }

  // 2. Print QR cards on back with matching numbers (horizontal mirror per row)
  for (let page = 0; page < totalPages; page++) {
    doc.addPage();
    for (let i = 0; i < cardsPerPage; i++) {
      const idx = page * cardsPerPage + i;
      if (idx >= totalCards) break;
      // mirror horizontally: same row, flipped column
      const dataRow = Math.floor(i / CARDS_PER_ROW);
      const dataCol = i % CARDS_PER_ROW;
      const rowPos = dataRow;
      const colPos = CARDS_PER_ROW - 1 - dataCol;
      const x = MARGIN_X + colPos * (CARD_SIZE + GAP);
      const y = MARGIN_Y + rowPos * (CARD_SIZE + GAP);
      doc.setDrawColor(0);
      doc.rect(x, y, CARD_SIZE, CARD_SIZE);
      // Card number
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(String(idx + 1), x + 2, y + 3);
      if (rows[idx].YOUTUBE) {
        try {
          const qrDataUrl = await generateQRCodeDataURL(rows[idx].YOUTUBE);
          doc.addImage(
            qrDataUrl,
            "PNG",
            x + 8,
            y + 8,
            CARD_SIZE - 16,
            CARD_SIZE - 16
          );
        } catch {
          doc.setFontSize(10);
          doc.text("QR Error", x + CARD_SIZE / 2, y + CARD_SIZE / 2, {
            align: "center",
          });
        }
      } else {
        doc.setFontSize(10);
        doc.text("Sin QR", x + CARD_SIZE / 2, y + CARD_SIZE / 2, {
          align: "center",
        });
      }
    }
  }

  doc.save("tarjetas.pdf");
}

export default function PDFCardGenerator() {
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const theme = useTheme();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    if (!e.target.files || e.target.files.length === 0) return;
    setFile(e.target.files[0]);
  };

  const handleGenerate = async () => {
    setError("");
    if (!file) {
      setError("Selecciona un archivo Excel primero.");
      return;
    }
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet);
      await generatePDF(rows);
    } catch (e: unknown) {
      let message = "Error desconocido";
      if (e instanceof Error) message = e.message;
      setError("Error procesando el archivo: " + message);
    }
  };

  const handleDownloadSamples = async () => {
    // Load music note image from public folder
    const img = new Image();
    img.src = "/nota-musical.png";
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
    });
    const doc = new jsPDF({ unit: "mm", format: "letter" });
    const totalCards = SAMPLE_COLS * SAMPLE_ROWS;
    const cardsPerPage = SAMPLE_COLS * SAMPLE_ROWS;
    const totalPages = Math.ceil(totalCards / cardsPerPage);
    for (let page = 0; page < totalPages; page++) {
      if (page > 0) doc.addPage();
      for (let i = 0; i < cardsPerPage; i++) {
        const idx = page * cardsPerPage + i;
        if (idx >= totalCards) break;
        const rowPos = Math.floor(i / SAMPLE_COLS);
        const colPos = i % SAMPLE_COLS;
        const x = SAMPLE_MARGIN_X + colPos * (SAMPLE_CARD_SIZE + GAP);
        const y = SAMPLE_MARGIN_Y + rowPos * (SAMPLE_CARD_SIZE + GAP);
        doc.setDrawColor(0);
        doc.rect(x, y, SAMPLE_CARD_SIZE, SAMPLE_CARD_SIZE);
        // Logo if provided
        const logoSize = SAMPLE_CARD_SIZE * 0.25;
        if (
          logoDataUrl &&
          !logoDataUrl.includes("DATA_URL_OF_YOUR_LOGO_HERE")
        ) {
          doc.addImage(
            logoDataUrl,
            "PNG",
            x + (SAMPLE_CARD_SIZE - logoSize) / 2,
            y + 4,
            logoSize,
            logoSize
          );
        }
        // Music note image
        const iconSize = SAMPLE_CARD_SIZE * 0.5;
        doc.addImage(
          img,
          "PNG",
          x + (SAMPLE_CARD_SIZE - iconSize) / 2,
          y + (SAMPLE_CARD_SIZE - iconSize) / 2,
          iconSize,
          iconSize
        );
      }
    }
    doc.save("fichas.pdf");
  };

  return (
    <>
      <div className="admin-ocean-background" />
      <div className="admin-ocean-blur" />
      <Box className="admin-neon-lines">
        <Box
          className="admin-neon-line"
          sx={{
            top: "15%",
            background: theme.customGradients.plasma,
            animation: "neon-move-right 28s ease-in-out infinite",
          }}
        />
        <Box
          className="admin-neon-line"
          sx={{
            top: "38%",
            background: theme.customGradients.sunset,
            animation: "neon-move-left 32s ease-in-out infinite",
          }}
        />
        <Box
          className="admin-neon-line"
          sx={{
            top: "62%",
            background: theme.customGradients.lagoon,
            animation: "neon-move-right 26s ease-in-out infinite",
          }}
        />
      </Box>

      <Container
        maxWidth="lg"
        disableGutters
        sx={{ position: "relative", zIndex: 1, py: { xs: 4, md: 6 } }}
      >
        <Paper
          elevation={0}
          sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: { xs: 4, md: 5 },
            px: { xs: 2.5, sm: 4, md: 6 },
            py: { xs: 3, sm: 4, md: 6 },
            color: "#f8fbff",
            background: `linear-gradient(145deg, ${alpha(
              theme.palette.primary.dark,
              0.78
            )} 0%, ${alpha(theme.palette.secondary.dark, 0.72)} 48%, ${alpha(
              theme.palette.info.dark,
              0.7
            )} 100%)`,
            border: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(22px)",
            boxShadow:
              "0 25px 80px rgba(12, 20, 40, 0.55), inset 0 1px 0 rgba(255,255,255,0.25)",
            "&::before": {
              content: "''",
              position: "absolute",
              inset: "-40% -40% 30% -40%",
              background: `radial-gradient(circle at 15% 20%, ${alpha(
                theme.palette.info.light,
                0.48
              )} 0%, transparent 55%), radial-gradient(circle at 88% 18%, ${alpha(
                theme.palette.secondary.light,
                0.38
              )} 0%, transparent 55%), radial-gradient(circle at 45% 82%, ${alpha(
                theme.palette.success.light,
                0.42
              )} 0%, transparent 55%)`,
              filter: "blur(30px)",
              opacity: 0.75,
            },
          }}
        >
          <Stack
            spacing={{ xs: 3, md: 4 }}
            sx={{ position: "relative", zIndex: 1 }}
          >
            <Stack spacing={1.5} alignItems="center">
              <Box
                component="img"
                src="/ponchister_logo.png"
                alt="Ponchister Logo"
                sx={{
                  width: { xs: "70%", sm: "52%", md: 320 },
                  maxWidth: 360,
                  filter: "drop-shadow(0 18px 48px rgba(10,18,36,0.45))",
                }}
              />
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textAlign: "center",
                  textTransform: "uppercase",
                  color: alpha("#f8fbff", 0.92),
                }}
              >
                Generador de Tarjetas Premium
              </Typography>
              <Typography
                variant="subtitle1"
                sx={{
                  textAlign: "center",
                  maxWidth: 560,
                  color: alpha("#f8fbff", 0.72),
                  fontWeight: 500,
                }}
              >
                Convierte tu playlist en tarjetas físicas con QR listos para
                imprimir en doble cara.
              </Typography>
            </Stack>

            <Stack spacing={2} alignItems="center">
              <input
                hidden
                accept=".xls,.xlsx"
                id="upload-excel"
                type="file"
                onChange={handleFile}
              />
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={{ xs: 1.5, sm: 2 }}
                justifyContent="center"
                sx={{ width: "100%" }}
              >
                <label htmlFor="upload-excel" style={{ width: "100%" }}>
                  <Button
                    variant="contained"
                    component="span"
                    startIcon={<UploadFileIcon />}
                    fullWidth
                    size="large"
                  >
                    Seleccionar Excel
                  </Button>
                </label>
                <Button
                  variant="contained"
                  color="error"
                  onClick={handleGenerate}
                  startIcon={<PictureAsPdfIcon />}
                  fullWidth
                  size="large"
                >
                  Generar PDF
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  href="/plantilla.xlsx"
                  download
                  startIcon={<DownloadIcon />}
                  fullWidth
                  size="large"
                >
                  Descargar Excel
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={handleDownloadSamples}
                  startIcon={<MusicNoteIcon />}
                  fullWidth
                  size="large"
                >
                  Descargar fichas
                </Button>
              </Stack>
              {file ? (
                <Typography
                  variant="body2"
                  sx={{
                    color: alpha("#f8fbff", 0.78),
                    fontWeight: 500,
                  }}
                >
                  Archivo seleccionado: {file.name}
                </Typography>
              ) : null}
            </Stack>

            {error ? (
              <Alert
                severity="error"
                sx={{
                  borderRadius: 3,
                  bgcolor: alpha(theme.palette.error.dark, 0.15),
                  border: `1px solid ${alpha(theme.palette.error.light, 0.35)}`,
                  color: alpha("#fff", 0.95),
                  fontSize: { xs: 14, sm: 15 },
                }}
              >
                {error}
              </Alert>
            ) : null}

            <Stack spacing={3}>
              <Typography
                variant="body1"
                sx={{
                  fontSize: { xs: 15, md: 17 },
                  lineHeight: 1.8,
                  color: alpha("#f8fbff", 0.82),
                  textAlign: "center",
                }}
              >
                Sube un archivo Excel con las columnas <b>ARTISTA</b>,{" "}
                <b>CANCION</b>, <b>LANZAMIENTO</b> y <b>YOUTUBE</b>. Cada
                canción genera dos tarjetas numeradas listas para imprimir en
                doble cara: información por la cara A y QR alineado por la cara
                B.
              </Typography>

              <Paper
                variant="outlined"
                sx={{
                  borderRadius: 4,
                  bgcolor: alpha("#f8fbff", 0.96),
                  color: alpha(theme.palette.text.primary, 0.92),
                  borderColor: alpha(theme.palette.primary.dark, 0.15),
                  px: { xs: 2, sm: 3 },
                  py: { xs: 2.5, sm: 3.5 },
                  boxShadow: "0 28px 55px rgba(15, 23, 42, 0.18)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    mb: { xs: 1.5, sm: 2 },
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: theme.palette.primary.dark,
                  }}
                >
                  Ejemplo de archivo Excel
                </Typography>
                <Box
                  component="table"
                  sx={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: { xs: 13, sm: 15 },
                    color: alpha(theme.palette.text.primary, 0.88),
                    background: alpha("#ffffff", 0.9),
                    borderRadius: 3,
                    overflow: "hidden",
                    border: `1px solid ${alpha(
                      theme.palette.primary.dark,
                      0.12
                    )}`,
                  }}
                >
                  <Box
                    component="thead"
                    sx={{ background: alpha(theme.palette.primary.main, 0.12) }}
                  >
                    <Box component="tr">
                      {["ARTISTA", "CANCION", "LANZAMIENTO", "YOUTUBE"].map(
                        (header) => (
                          <Box
                            key={header}
                            component="th"
                            sx={{
                              border: `1px solid ${alpha(
                                theme.palette.primary.dark,
                                0.14
                              )}`,
                              px: 1.5,
                              py: 1,
                              fontWeight: 700,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                              textAlign: "left",
                              color: theme.palette.primary.dark,
                            }}
                          >
                            {header}
                          </Box>
                        )
                      )}
                    </Box>
                  </Box>
                  <Box component="tbody">
                    {[
                      {
                        ARTISTA: "Mon Laferte",
                        CANCION: "Tu falta de querer",
                        LANZAMIENTO: "2015",
                        YOUTUBE: "https://youtube.com/ejemplo",
                      },
                      {
                        ARTISTA: "Los Bunkers",
                        CANCION: "Bailando solo",
                        LANZAMIENTO: "2013",
                        YOUTUBE: "https://youtube.com/ejemplo2",
                      },
                    ].map((row) => (
                      <Box component="tr" key={row.CANCION}>
                        {Object.values(row).map((value) => (
                          <Box
                            key={value}
                            component="td"
                            sx={{
                              border: `1px solid ${alpha(
                                theme.palette.primary.dark,
                                0.12
                              )}`,
                              px: 1.5,
                              py: 1,
                              fontWeight: 500,
                              letterSpacing: "0.01em",
                            }}
                          >
                            {value}
                          </Box>
                        ))}
                      </Box>
                    ))}
                  </Box>
                </Box>

                <Stack
                  spacing={1.5}
                  sx={{
                    mt: { xs: 2.5, sm: 3 },
                    color: alpha(theme.palette.text.secondary, 0.95),
                    fontSize: { xs: 14, sm: 15 },
                    lineHeight: 1.8,
                  }}
                >
                  <Typography component="span" sx={{ fontWeight: 600 }}>
                    ¿Cómo funciona?
                  </Typography>
                  <Typography component="span">
                    1. Sube tu archivo Excel con tus canciones.
                  </Typography>
                  <Typography component="span">
                    2. Haz clic en <b>Generar PDF</b> para crear las tarjetas
                    numeradas.
                  </Typography>
                  <Typography component="span">
                    3. Imprime a doble cara: cara A con datos, cara B con QR
                    alineado.
                  </Typography>
                  <Typography component="span">
                    4. Cada página acomoda 16 tarjetas (4x4) y el sistema añade
                    páginas adicionales automáticamente.
                  </Typography>
                </Stack>

                <Box sx={{ mt: { xs: 3, sm: 4 }, textAlign: "center" }}>
                  <Box
                    component="img"
                    src="/hoja.png"
                    alt="Ejemplo visual de tarjetas"
                    sx={{
                      width: "100%",
                      maxWidth: 520,
                      borderRadius: 4,
                      boxShadow: "0 25px 80px rgba(9, 17, 35, 0.45)",
                      border: `1px solid ${alpha("#f8fbff", 0.08)}`,
                      backdropFilter: "blur(8px)",
                    }}
                  />
                </Box>
              </Paper>
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </>
  );
}
