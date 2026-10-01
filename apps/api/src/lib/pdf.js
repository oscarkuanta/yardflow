import PDFDocument from 'pdfkit';

export const PDF_COLORS = {
  text: '#0B0F14',
  muted: '#5B6772',
  line: '#C9D0D6',
  damage: '#F6C6C6',
  accent: '#4F6B00',
};

export function renderPdf(title, draw) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 50, info: { Title: title } });
    const chunks = [];
    document.on('data', (chunk) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
    draw(document);
    document.end();
  });
}

export function drawTitle(document, { terminalName, title }) {
  document.fillColor(PDF_COLORS.accent).fontSize(10).text(terminalName.toUpperCase());
  document.fillColor(PDF_COLORS.text).fontSize(20).text(title);
  document.moveDown(0.8);
}

export function drawFields(document, fields) {
  for (const [label, value] of fields) {
    const y = document.y;
    document.fillColor(PDF_COLORS.muted).fontSize(10).text(label, 50, y, { width: 140 });
    document.fillColor(PDF_COLORS.text).fontSize(11).text(value, 200, y, { width: 340 });
    document.moveDown(0.3);
  }
  document.moveDown(0.8);
}
