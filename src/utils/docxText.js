import JSZip from 'jszip';

const esDocx = (file) =>
  file instanceof File &&
  (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name?.toLowerCase().endsWith('.docx'));

export const docxToText = async (file) => {
  if (!esDocx(file)) throw new Error('El archivo no es un documento Word (.docx)');

  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('No se pudo leer el contenido del archivo Word');

  const text = xml
    .replace(/<w:tab[^/]*\/>/g, '\t')
    .replace(/<w:br[^/]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, (_, t) => t)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!text) throw new Error('El archivo Word está vacío o no contiene texto legible');
  return text;
};

export { esDocx };
