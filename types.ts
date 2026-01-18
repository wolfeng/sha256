
export interface ExcelData {
  headers: string[];
  rows: any[];
  fileName: string;
}

export interface EncryptStatus {
  isProcessing: boolean;
  progress: number;
  message: string;
}
