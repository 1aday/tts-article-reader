"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "danger";
  loading?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  loading = false,
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !loading) {
      onClose();
    }
  };

  const handleConfirm = () => {
    if (!loading) {
      onConfirm();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fadeIn"
        onClick={handleBackdropClick}
      >
        {/* Dialog */}
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-6 bg-[#1a1a1a] border border-[#00ff4133] rounded-lg shadow-2xl animate-scaleIn">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {variant === "danger" && (
                <div className="p-2 bg-red-500/10 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                </div>
              )}
              <h2
                className={cn(
                  "text-xl font-bold",
                  variant === "danger"
                    ? "text-red-500"
                    : "text-[#00ff88]"
                )}
              >
                {title}
              </h2>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-gray-400 hover:text-[#00ff88] transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Message */}
          <p className="text-gray-300 mb-6 leading-relaxed">
            {message}
          </p>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="min-w-24"
            >
              {cancelText}
            </Button>
            <Button
              variant={variant === "danger" ? "danger" : "default"}
              onClick={handleConfirm}
              loading={loading}
              disabled={loading}
              className="min-w-24"
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
