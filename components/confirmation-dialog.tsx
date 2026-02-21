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
      <div
        className="fixed inset-0 z-50 bg-black/72 backdrop-blur-sm animate-fadeIn"
        onClick={handleBackdropClick}
      >
        <div className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-surface-1 p-6 shadow-[0_30px_80px_rgba(2,5,12,0.8)] animate-scaleIn">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {variant === "danger" && (
                <div className="rounded-full bg-red-500/10 p-2">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                </div>
              )}
              <h2
                className={cn(
                  "text-xl font-bold",
                  variant === "danger"
                    ? "text-red-500"
                    : "text-[#e50914]"
                )}
              >
                {title}
              </h2>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-white/40 transition-colors hover:text-[#e50914] disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="mb-6 leading-relaxed text-white/75">
            {message}
          </p>

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
