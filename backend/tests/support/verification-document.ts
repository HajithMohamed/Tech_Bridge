// A real 1x1 PNG; synthetic evidence only, never a personal document.
export const verificationPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aI9kAAAAASUVORK5CYII=', 'base64');
export const verificationUpload = (fileName = 'synthetic-evidence.png') => ({ fileName, content: verificationPng.toString('base64'), note: 'Synthetic organization evidence for isolated tests.' });
export const verificationPdf = (extra = '') => Buffer.from(`%PDF-1.7\n1 0 obj\n<< /Type /Catalog ${extra} >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`);
