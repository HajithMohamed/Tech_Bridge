import { AdminActionError } from './adminUsers';
import type { VerificationStatus } from '../models/ProviderVerification';

export const maxDocumentBytes = 2 * 1024 * 1024;
const invalid = (message = 'Upload a valid PDF, PNG or JPEG document.') => new AdminActionError(400, message);
const dimensions = (width: number, height: number) => width > 0 && height > 0 && width <= 8192 && height <= 8192 && width * height <= 16_000_000;

function isPng(data: Buffer): boolean {
  if (data.length < 57 || !data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return false;
  let offset = 8; let imageData = false; let header = false;
  while (offset + 12 <= data.length) {
    const length = data.readUInt32BE(offset);
    if (length > data.length - offset - 12) return false;
    const type = data.toString('ascii', offset + 4, offset + 8);
    if (!header) {
      if (type !== 'IHDR' || length !== 13 || !dimensions(data.readUInt32BE(offset + 8), data.readUInt32BE(offset + 12))) return false;
      header = true;
    } else if (type === 'IHDR') return false;
    if (type === 'IDAT' && length > 0) imageData = true;
    offset += length + 12;
    if (type === 'IEND') return length === 0 && imageData && offset === data.length;
  }
  return false;
}
function isJpeg(data: Buffer): boolean {
  if (data.length < 16 || data.readUInt16BE(0) !== 0xffd8 || data.readUInt16BE(data.length - 2) !== 0xffd9) return false;
  let offset = 2; let frame = false;
  while (offset + 4 <= data.length) {
    if (data[offset++] !== 0xff) return false;
    while (data[offset] === 0xff) offset++;
    const marker = data[offset++];
    if (offset + 2 > data.length) return false;
    const length = data.readUInt16BE(offset);
    if (length < 2 || offset + length > data.length) return false;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8 || !dimensions(data.readUInt16BE(offset + 5), data.readUInt16BE(offset + 3))) return false;
      frame = true;
    }
    if (marker === 0xda) return frame && length >= 6 && offset + length < data.length - 2;
    offset += length;
  }
  return false;
}
function isPdf(data: Buffer): boolean {
  const text = data.toString('latin1');
  if (!/^%PDF-(?:1\.[0-7]|2\.0)[\r\n]/.test(text) || !/%%EOF\s*$/.test(text)) return false;
  const names = text.replace(/#([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  // Conservative policy: encrypted/object-stream PDFs cannot be inspected here.
  return !/\/(?:JavaScript|JS|Launch|OpenAction|AA|EmbeddedFile|RichMedia|SubmitForm|ImportData|XFA|AcroForm|Encrypt|ObjStm)\b/i.test(names)
    && /\bobj\b/.test(text) && /\/Type\s*\/Catalog\b/.test(text);
}
export function validateVerificationDocument(body: unknown) {
  if (!body || typeof body !== 'object') throw invalid();
  const { fileName, content, note } = body as Record<string, unknown>;
  if (typeof fileName !== 'string' || fileName.length > 120 || !/^[a-zA-Z0-9][a-zA-Z0-9 _().-]*\.(pdf|png|jpe?g)$/i.test(fileName) || fileName.includes('..')) throw invalid('Use a document filename of 120 characters or fewer without paths or special characters.');
  if (typeof content !== 'string' || content.length > 4 * Math.ceil(maxDocumentBytes / 3)) throw new AdminActionError(413, 'Documents must be 2 MiB or smaller.');
  if (!content || content.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(content)) throw invalid();
  const data = Buffer.from(content, 'base64');
  if (data.length > maxDocumentBytes) throw new AdminActionError(413, 'Documents must be 2 MiB or smaller.');
  if (!data.length || data.toString('base64') !== content) throw invalid();
  const extension = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
  const contentType = extension === 'pdf' && isPdf(data) ? 'application/pdf' : extension === 'png' && isPng(data) ? 'image/png' : ['jpg', 'jpeg'].includes(extension) && isJpeg(data) ? 'image/jpeg' : undefined;
  if (!contentType) throw invalid('The document format is unsupported, malformed, or contains restricted PDF features.');
  if (note !== undefined && (typeof note !== 'string' || note.trim().length > 1000)) throw invalid('Submission notes must be 1000 characters or fewer.');
  return { fileName, contentType, data, size: data.length, note: typeof note === 'string' && note.trim() ? note.trim() : 'Supporting evidence submitted.' };
}
export function verificationTransition(from: VerificationStatus, action: string): VerificationStatus {
  if (action === 'verified' && from === 'PENDING') return 'VERIFIED';
  if (action === 'rejected' && ['PENDING', 'NEEDS_INFO'].includes(from)) return 'REJECTED';
  if (action === 'more_info' && ['PENDING', 'VERIFIED'].includes(from)) return 'NEEDS_INFO';
  throw new AdminActionError(409, 'This verification decision is no longer valid. Reload the provider.');
}
