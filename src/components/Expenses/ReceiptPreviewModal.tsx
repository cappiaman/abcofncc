// ==============================================================================
// RECEIPT PREVIEW MODAL
// ==============================================================================

import React from 'react';
import { Expense } from '../../types';
import { getReceiptImageUrl } from '../../lib/supabase';
import { X, ExternalLink, Download } from 'lucide-react';

interface ReceiptPreviewModalProps {
  expense: Expense | null;
  onClose: () => void;
}

export const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({
  expense,
  onClose,
}) => {
  if (!expense) return null;

  const imageUrl = getReceiptImageUrl(expense.receipt_image_path);
  const driveUrl = expense.drive_file_url;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Receipt:</span>
              <span className="font-mono text-sky-400">{expense.receipt_code}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {expense.merchant_or_payee || expense.description} • {expense.expense_date}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image Display */}
        <div className="flex-1 overflow-auto p-4 bg-slate-950 flex items-center justify-center min-h-[300px]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`Receipt ${expense.receipt_code}`}
              className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-md"
            />
          ) : (
            <div className="text-center p-8 text-slate-500">
              <p className="text-sm">No image available for this expense.</p>
              <p className="text-xs mt-1">Logged as Cash / Manual entry without attachment.</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-400">
            {expense.drive_file_id ? (
              <span className="text-emerald-400 font-medium">✓ Archived in Company Drive Folder</span>
            ) : (
              <span>Not uploaded to Drive</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {driveUrl && (
              <a
                href={driveUrl}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Google Drive
              </a>
            )}
            {imageUrl && (
              <a
                href={imageUrl}
                download={`${expense.receipt_code}.jpg`}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
