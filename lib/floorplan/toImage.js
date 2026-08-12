// lib/floorplan/toImage.js
// Converts an uploaded floor-plan file (PDF, JPG, or PNG) into a single
// image data URL: the API route needs a real bitmap both to send to Gemini
// Vision and to display in the browser (browsers can't render a PDF inside
// an <img> tag, and pin overlays need real pixel dimensions to position
// against). JPG/PNG pass through unchanged, just re-wrapped as a data URL.
//
// PDF rendering uses unpdf + @napi-rs/canvas, NOT pdf-to-img. pdf-to-img
// (which wraps pdfjs-dist directly) works fine locally but throws
// "ReferenceError: DOMMatrix is not defined" on Vercel's serverless
// runtime — pdfjs-dist's legacy Node build needs a real canvas
// implementation for its internal transform math, and the classic `canvas`
// package it expects requires a native compile step that doesn't survive
// Vercel's serverless bundling. @napi-rs/canvas ships prebuilt binaries
// (no native compile), and unpdf's renderPageAsImage() is built specifically
// to use it in serverless/edge runtimes — this is the documented fix for
// this exact, very common pdfjs-in-serverless failure.

import { getDocumentProxy, renderPageAsImage } from 'unpdf';

const MAX_BYTES = 4 * 1024 * 1024; // 4MB — Vercel serverless functions cap request bodies around 4.5MB

export class FloorPlanInputError extends Error {}

// file: a File/Blob from a Next.js Route Handler's formData().
export async function fileToImageDataUrl(file) {
  if (!file) throw new FloorPlanInputError('No file uploaded.');
  if (file.size > MAX_BYTES) throw new FloorPlanInputError('File is too large — please keep it under 4MB.');

  const buf = Buffer.from(await file.arrayBuffer());
  const type = file.type || '';

  if (type === 'application/pdf' || (file.name || '').toLowerCase().endsWith('.pdf')) {
    let pngDataUrl;
    try {
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      pngDataUrl = await renderPageAsImage(pdf, 1, {
        canvasImport: () => import('@napi-rs/canvas'),
        scale: 2, // sharper render — floor plans have small text/labels
        toDataURL: true,
      });
    } catch (err) {
      console.error('PDF render failed:', err);
      throw new FloorPlanInputError('Could not read that PDF — is it a valid, unencrypted floor-plan file?');
    }
    return pngDataUrl; // unpdf already returns a full "data:image/png;base64,..." string
  }

  if (type === 'image/jpeg' || type === 'image/jpg' || type === 'image/png' || type === 'image/webp') {
    return `data:${type};base64,${buf.toString('base64')}`;
  }

  throw new FloorPlanInputError('Please upload a PDF, JPG, or PNG floor plan.');
}
