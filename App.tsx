
import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { ExcelData, EncryptStatus } from './types';
import { sha256 } from './utils/crypto';
import { FileUp, ShieldCheck, Download, Trash2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [data, setData] = useState<ExcelData | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<EncryptStatus>({
    isProcessing: false,
    progress: 0,
    message: ''
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const bstr = event.target?.result;
      const workbook = XLSX.read(bstr, { type: 'binary' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length > 0) {
        const headers = jsonData[0].map(h => String(h || ''));
        const rows = jsonData.slice(1).map(row => {
          const rowObj: any = {};
          headers.forEach((header, index) => {
            rowObj[header] = row[index] !== undefined ? row[index] : '';
          });
          return rowObj;
        });

        setData({
          headers,
          rows,
          fileName: file.name
        });
        setSelectedColumns(new Set());
        setStatus({ isProcessing: false, progress: 0, message: '文件已加载' });
      }
    };
    reader.readAsBinaryString(file);
  };

  const toggleColumn = (col: string) => {
    const newSet = new Set(selectedColumns);
    if (newSet.has(col)) {
      newSet.delete(col);
    } else {
      newSet.add(col);
    }
    setSelectedColumns(newSet);
  };

  const handleProcessAndDownload = async () => {
    if (!data || selectedColumns.size === 0) return;

    setStatus({ isProcessing: true, progress: 0, message: '正在进行加密处理...' });

    try {
      const processedRows = [...data.rows];
      const encryptionTasks = [];

      for (let i = 0; i < processedRows.length; i++) {
        const row = processedRows[i];
        const selectedColsArray = Array.from(selectedColumns);
        
        for (const col of selectedColsArray) {
          const originalValue = String(row[col] || '');
          const newFieldName = `${col}密文`;
          
          // Encrypt
          const encryptedValue = await sha256(originalValue);
          row[newFieldName] = encryptedValue;
        }

        if (i % 10 === 0 || i === processedRows.length - 1) {
          setStatus(prev => ({
            ...prev,
            progress: Math.round(((i + 1) / processedRows.length) * 100)
          }));
        }
      }

      // Generate New Excel
      const newHeaders = [...data.headers];
      selectedColumns.forEach(col => {
        newHeaders.push(`${col}密文`);
      });

      const worksheetData = [newHeaders];
      processedRows.forEach(row => {
        const rowData = newHeaders.map(h => row[h]);
        worksheetData.push(rowData);
      });

      const ws = XLSX.utils.aoa_to_sheet(worksheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Encrypted Data");

      const outputFileName = data.fileName.replace(/\.xlsx?$/, '') + '_encrypted.xlsx';
      XLSX.writeFile(wb, outputFileName);

      setStatus({
        isProcessing: false,
        progress: 100,
        message: '加密完成！文件已开始下载。'
      });
    } catch (error) {
      console.error(error);
      setStatus({
        isProcessing: false,
        progress: 0,
        message: '处理过程中出错，请重试。'
      });
    }
  };

  const reset = () => {
    setData(null);
    setSelectedColumns(new Set());
    setStatus({ isProcessing: false, progress: 0, message: '' });
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      {/* Header */}
      <header className="w-full max-w-4xl mb-8 text-center">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center justify-center gap-2">
          <ShieldCheck className="text-indigo-600 w-10 h-10" />
          Excel 字段加密工具
        </h1>
        <p className="text-slate-500 mt-2">支持本地处理，保护您的数据隐私</p>
      </header>

      <main className="w-full max-w-4xl bg-white rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100">
        {!data ? (
          /* Upload State */
          <div className="p-12">
            <label className="group relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-indigo-400 transition-all">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <div className="p-4 bg-indigo-50 rounded-full mb-4 group-hover:scale-110 transition-transform">
                  <FileUp className="w-8 h-8 text-indigo-600" />
                </div>
                <p className="mb-2 text-sm text-slate-700 font-medium">
                  点击或拖拽上传 Excel 文件
                </p>
                <p className="text-xs text-slate-400">支持 .xlsx, .xls 格式</p>
              </div>
              <input 
                type="file" 
                className="hidden" 
                accept=".xlsx, .xls" 
                onChange={handleFileUpload}
              />
            </label>
          </div>
        ) : (
          /* Field Selection State */
          <div className="flex flex-col h-full">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-800 text-lg">{data.fileName}</h2>
                <p className="text-sm text-slate-500">共 {data.rows.length} 条数据，包含 {data.headers.length} 个字段</p>
              </div>
              <button 
                onClick={reset}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                title="重新上传"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">选择需要进行 SHA-256 加密的字段：</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {data.headers.map((header) => (
                  <button
                    key={header}
                    onClick={() => toggleColumn(header)}
                    className={`flex items-center px-4 py-3 rounded-lg border transition-all text-left ${
                      selectedColumns.has(header)
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border mr-3 flex items-center justify-center ${
                      selectedColumns.has(header) ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'
                    }`}>
                      {selectedColumns.has(header) && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <span className="truncate font-medium">{header}</span>
                  </button>
                ))}
              </div>

              <div className="mt-12 flex flex-col items-center">
                <button
                  onClick={handleProcessAndDownload}
                  disabled={selectedColumns.size === 0 || status.isProcessing}
                  className={`w-full max-w-xs py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-3 transition-all ${
                    selectedColumns.size > 0 && !status.isProcessing
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg shadow-indigo-200'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {status.isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                  {status.isProcessing ? '处理中...' : '生成并下载加密文件'}
                </button>

                {status.isProcessing && (
                  <div className="mt-6 w-full max-w-md">
                    <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-full transition-all duration-300 ease-out" 
                        style={{ width: `${status.progress}%` }}
                      />
                    </div>
                    <p className="text-center text-sm text-slate-500">{status.message} ({status.progress}%)</p>
                  </div>
                )}

                {status.message && !status.isProcessing && (
                  <div className={`mt-6 flex items-center gap-2 p-3 rounded-lg ${
                    status.message.includes('完成') ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                  }`}>
                    {status.message.includes('完成') ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <span className="text-sm font-medium">{status.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="mt-12 w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
          <h4 className="font-semibold text-slate-800 mb-2">安全可靠</h4>
          <p className="text-sm text-slate-500 leading-relaxed">
            所有加密过程均在您的浏览器本地完成，数据不会被上传到任何服务器，确保您的私密信息万无一失。
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
          <h4 className="font-semibold text-slate-800 mb-2">SHA-256 加密</h4>
          <p className="text-sm text-slate-500 leading-relaxed">
            使用行业标准的 SHA-256 哈希算法，生成不可逆的 64 位十六进制字符，保护敏感字段如手机号或证件号。
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
          <h4 className="font-semibold text-slate-800 mb-2">智能处理</h4>
          <p className="text-sm text-slate-500 leading-relaxed">
            自动识别 Excel 表头，加密后将在原数据旁新增以“密文”结尾的新列，保持原始数据完整。
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
