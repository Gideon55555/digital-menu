'use client';

import { useEffect, useRef, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Download, Copy, Printer, Check } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

export default function QRCodePage() {
  const [menuUrl, setMenuUrl] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  // Get the real menu URL from the browser
  useEffect(() => {
    setMenuUrl(`${window.location.origin}/menu`);
  }, []);

  // Generate URL based on optional table number
  const qrUrl =
    menuUrl && tableNumber.trim()
      ? `${menuUrl}?table=${encodeURIComponent(tableNumber.trim())}`
      : menuUrl;

  // Copy URL
  const handleCopyUrl = async () => {
    if (!qrUrl) return;

    try {
      await navigator.clipboard.writeText(qrUrl);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
      alert('Failed to copy URL. Please copy it manually.');
    }
  };

  // Print QR code
  const handlePrint = () => {
    window.print();
  };

  // Download QR code as PNG
  const handleDownload = () => {
    if (!qrUrl) {
      alert('QR code is not ready yet.');
      return;
    }

    const canvas = qrRef.current?.querySelector(
      'canvas'
    ) as HTMLCanvasElement | null;

    if (!canvas) {
      alert('QR code is not ready yet. Please try again.');
      return;
    }

    try {
      const downloadCanvas = document.createElement('canvas');

      const padding = 40;
      const size = canvas.width + padding * 2;

      downloadCanvas.width = size;
      downloadCanvas.height = size;

      const context = downloadCanvas.getContext('2d');

      if (!context) {
        throw new Error('Could not create canvas context');
      }

      // White background
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, size, size);

      // Draw QR code with padding
      context.drawImage(
        canvas,
        padding,
        padding,
        canvas.width,
        canvas.height
      );

      const link = document.createElement('a');

      const filename = tableNumber.trim()
        ? `menu-qr-table-${tableNumber.trim()}.png`
        : 'menu-qr.png';

      link.download = filename;
      link.href = downloadCanvas.toDataURL('image/png');

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download QR code:', error);
      alert('Failed to download QR code.');
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-2xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-serif font-bold text-restaurant-text dark:text-white">
            QR Code Generator
          </h1>

          <p className="text-restaurant-text-light dark:text-gray-400 mt-1">
            Generate QR codes for your digital menu
          </p>
        </div>

        {/* Table Number Input */}
        <div className="restaurant-card p-6">
          <label
            htmlFor="table-number"
            className="block text-sm font-medium text-restaurant-text dark:text-white mb-2"
          >
            Table Number
          </label>

          <input
            id="table-number"
            type="text"
            inputMode="numeric"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            placeholder="Leave blank for general menu"
            className="w-full px-4 py-2 border border-cream-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-restaurant-text dark:text-white rounded-lg focus:ring-2 focus:ring-restaurant-accent/50 focus:border-transparent transition-all"
          />

          <p className="text-xs text-restaurant-text-light dark:text-gray-400 mt-2">
            Add a table number to create a table-specific QR code.
            For example, Table 5 will generate a URL ending in{' '}
            <span className="font-medium">?table=5</span>.
          </p>
        </div>

        {/* Menu URL */}
        <div className="restaurant-card p-6">
          <label
            htmlFor="menu-url"
            className="block text-sm font-medium text-restaurant-text dark:text-white mb-2"
          >
            Menu URL
          </label>

          <div className="flex items-center gap-2">
            <input
              id="menu-url"
              type="text"
              value={qrUrl || 'Generating menu URL...'}
              readOnly
              className="flex-1 min-w-0 px-4 py-2 border border-cream-200 dark:border-slate-700 bg-cream-50 dark:bg-slate-800 text-restaurant-text dark:text-white rounded-lg"
            />

            <button
              onClick={handleCopyUrl}
              disabled={!qrUrl}
              className="flex-shrink-0 p-2 bg-restaurant-accent text-white rounded-lg hover:bg-restaurant-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Copy URL"
            >
              {copied ? (
                <Check size={20} />
              ) : (
                <Copy size={20} />
              )}
            </button>
          </div>

          {copied && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-2">
              URL copied to clipboard!
            </p>
          )}
        </div>

        {/* QR Code Display */}
        <div
          ref={qrRef}
          className="restaurant-card p-6 text-center print:border-0 print:shadow-none"
        >
          <h2 className="text-lg font-semibold text-restaurant-text dark:text-white mb-4">
            {tableNumber.trim()
              ? `Table ${tableNumber.trim()} QR Code`
              : 'Menu QR Code'}
          </h2>

          <div className="flex justify-center">
            {qrUrl ? (
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <QRCodeCanvas
                  value={qrUrl}
                  size={256}
                  level="H"
                  includeMargin={true}
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>
            ) : (
              <div className="w-[288px] h-[288px] flex items-center justify-center bg-gray-100 dark:bg-slate-800 rounded-lg">
                <span className="text-sm text-gray-500">
                  Generating QR code...
                </span>
              </div>
            )}
          </div>

          <p className="text-sm text-restaurant-text-light dark:text-gray-400 mt-4">
            Scan this QR code with a phone camera to access the
            menu.
          </p>

          {tableNumber.trim() && (
            <p className="text-sm font-medium text-restaurant-accent mt-2">
              This QR code is configured for Table{' '}
              {tableNumber.trim()}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4 print:hidden">
          <button
            onClick={handleDownload}
            disabled={!qrUrl}
            className="flex items-center gap-2 px-6 py-2 bg-restaurant-accent text-white rounded-lg hover:bg-restaurant-accent-dark transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={20} />
            Download PNG
          </button>

          <button
            onClick={handlePrint}
            disabled={!qrUrl}
            className="flex items-center gap-2 px-6 py-2 bg-cream-200 dark:bg-slate-800 text-restaurant-text dark:text-white rounded-lg hover:bg-cream-300 dark:hover:bg-slate-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer size={20} />
            Print
          </button>
        </div>

        {/* Tips */}
        <div className="restaurant-card p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 print:hidden">
          <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
            💡 Tips
          </h3>

          <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
            <li>
              • Place QR codes on tables so customers can scan to
              view the menu
            </li>

            <li>
              • Create a different QR code for each table if you
              want table-specific features
            </li>

            <li>
              • Download and print the QR code after generating it
            </li>

            <li>
              • Test every QR code with your phone camera before
              printing
            </li>

            <li>
              • The QR code always points to your current website
              domain
            </li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
}