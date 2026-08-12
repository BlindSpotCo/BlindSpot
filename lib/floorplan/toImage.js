// lib/floorplan/toImage.js
// Converts an uploaded floor-plan file (PDF, JPG, or PNG) into a single
// image data URL: the API route needs a real bitmap both to send to Gemini
// Vision and to display in the browser (browsers can't render a PDF inside
// an <img> tag, and pin overlays need real pixel dimensions to position
// against). PDFs get their first page rendered to PNG via pdf-to-img, which
// wraps pdfium as WASM — no native build step, safe on Vercel serverless.
// JPG/PNG pass through unchanged, just re-wrapped as a data URL.

import { pdf } from 'pdf-to-img';

const MAX_BYTES = 4 * 1024 * 1024; // 4MB — Vercel serverless functions cap request bodies around 4.5MB

export class FloorPlanInputError extends Error {}

// file: a File/Blob from a Next.js Route Handler's formData().
export async function fileToImageDataUrl(file) {
  if (!file) throw new FloorPlanInputError('No file uploaded.');
  if (file.size > MAX_BYTES) throw new FloorPlanInputError('File is too large — please keep it under 4MB.');

  const buf = Buffer.from(await file.arrayBuffer());
  const type = file.type || '';

  if (type === 'application/pdf' || (file.name || '').toLowerCase().endsWith('.pdf')) {
    let doc;
    try {
      // scale:2 for a sharper render — floor plans have small text/labels.
      doc = await pdf(buf, { scale: 2 });
    } catch {
      throw new FloorPlanInputError('Could not read that PDF — is it a valid, unencrypted floor-plan file?');
    }
    if (!doc.length) throw new FloorPlanInputError('That PDF has no pages.');
    const pageBuf = await doc.getPage(1);
    await doc.destroy();
    return `data:image/png;base64,${pageBuf.toString('base64')}`;
  }

  if (type === 'image/jpeg' || type === 'image/jpg' || type === 'image/png' || type === 'image/webp') {
    return `data:${type};base64,${buf.toString('base64')}`;
  }

  throw new FloorPlanInputError('Please upload a PDF, JPG, or PNG floor plan.');
}
