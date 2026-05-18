'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function usePromptDialog() {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const resolveRef = useRef<((val: string | null) => void) | null>(null);

  const openPrompt = useCallback((lbl: string, defaultValue = ''): Promise<string | null> => {
    setLabel(lbl);
    setValue(defaultValue);
    setOpen(true);
    return new Promise<string | null>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function handleConfirm() {
    const result = value.trim() || null;
    setOpen(false);
    resolveRef.current?.(result);
    resolveRef.current = null;
  }

  function handleCancel() {
    setOpen(false);
    resolveRef.current?.(null);
    resolveRef.current = null;
  }

  const promptDialog = (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleCancel();
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleConfirm();
            }
            if (e.key === 'Escape') handleCancel();
          }}
          autoFocus
          placeholder="Nhập URL..."
        />
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Huỷ
          </Button>
          <Button onClick={handleConfirm}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return [promptDialog, openPrompt] as const;
}
