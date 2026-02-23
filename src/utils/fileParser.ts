import * as PDFJS from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

// Set up PDF.js worker
PDFJS.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS.version}/pdf.worker.min.js`;

export interface FileData {
  name: string;
  content: string;
  type: string;
  size: number;
}

export async function parseFile(file: File): Promise<FileData> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  let content = '';

  try {
    if (extension === 'pdf') {
      content = await parsePDF(file);
    } else if (['xlsx', 'xls', 'csv'].includes(extension || '')) {
      content = await parseExcel(file);
    } else if (['docx', 'doc'].includes(extension || '')) {
      content = await parseWord(file);
    } else if (['txt', 'md', 'json', 'js', 'ts', 'py', 'html', 'css'].includes(extension || '')) {
      content = await file.text();
    } else {
      throw new Error('Unsupported file format');
    }

    return {
      name: file.name,
      content,
      type: file.type,
      size: file.size
    };
  } catch (error) {
    console.error(`Error parsing file ${file.name}:`, error);
    throw error;
  }
}

async function parsePDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = PDFJS.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

async function parseExcel(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer);
  let fullText = '';

  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    fullText += `Sheet: ${sheetName}\n${csv}\n\n`;
  });

  return fullText;
}

async function parseWord(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}
