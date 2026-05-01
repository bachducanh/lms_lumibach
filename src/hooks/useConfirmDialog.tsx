'use client';

import { useState, useCallback, useRef } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const resolveRef = useRef<((val: boolean) => void) | null>(null);

  const openConfirm = useCallback((msg: string): Promise<boolean> => {
    setMessage(msg);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function handleConfirm() {
    setOpen(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }

  function handleCancel() {
    setOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }

  const confirmDialog = (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xác nhận</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Huỷ</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} variant="destructive">Xác nhận</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return [confirmDialog, openConfirm] as const;
}
