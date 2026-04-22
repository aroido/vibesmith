/**
 * Suggestions Modal - Context Optimization (Spec §5.2.2)
 * Tailwind CSS + Radix Dialog + AlertDialog + Checkbox
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ComponentIcon } from '@/components/common';
import { useBulkDisableComponents } from '../hooks/useContextStats';
import type { Suggestion } from '../types';

const TYPE_SECTION_CLASSES: Partial<Record<Suggestion['type'], string>> = {
  unused:
    'border-[color-mix(in_srgb,var(--color-state-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-state-danger)_8%,transparent)]',
  duplicate:
    'border-[color-mix(in_srgb,var(--color-state-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-state-warning)_8%,transparent)]',
  oversized:
    'border-[color-mix(in_srgb,#f97316_30%,transparent)] bg-[color-mix(in_srgb,#f97316_8%,transparent)]',
  tech_mismatch:
    'border-[color-mix(in_srgb,var(--color-state-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-state-warning)_8%,transparent)]',
  global_overuse:
    'border-[color-mix(in_srgb,#6366f1_30%,transparent)] bg-[color-mix(in_srgb,#6366f1_8%,transparent)]',
};

export interface SuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: Suggestion[];
  onDisableSuccess: (count: number) => void;
}

const TYPE_LABEL_KEYS: Partial<Record<Suggestion['type'], string>> = {
  unused: 'suggestions.typeUnused',
  duplicate: 'suggestions.typeDuplicate',
  oversized: 'suggestions.typeOversized',
  tech_mismatch: 'suggestions.typeTechMismatch',
  global_overuse: 'suggestions.typeGlobalOveruse',
};

export function SuggestionsModal({
  isOpen,
  onClose,
  suggestions,
  onDisableSuccess,
}: SuggestionsModalProps) {
  const { t } = useTranslation('dashboard');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const { mutate: bulkDisable, isPending } = useBulkDisableComponents();

  const resetSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  useEffect(() => {
    if (!isOpen) resetSelection();
  }, [isOpen, resetSelection]);

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(suggestions.map((s) => s.component_id)));
  const deselectAll = () => setSelectedIds(new Set());

  const handleDisableClick = () => {
    if (selectedIds.size === 0) return;
    setShowConfirm(true);
  };

  const handleConfirmDisable = () => {
    const ids = Array.from(selectedIds);
    bulkDisable(ids, {
      onSuccess: (res) => {
        setShowConfirm(false);
        onDisableSuccess(res.updated_count);
        onClose();
      },
      onError: () => {
        setShowConfirm(false);
        // Error toast handled by mutation or caller - Dashboard could pass onError
      },
    });
  };

  const grouped = suggestions.reduce(
    (acc, s) => {
      if (!acc[s.type]) acc[s.type] = [];
      acc[s.type].push(s);
      return acc;
    },
    {} as Record<Suggestion['type'], Suggestion[]>
  );

  const order: Suggestion['type'][] = ['unused', 'duplicate', 'oversized'];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-theme-elevated border-theme text-theme-primary">
          <DialogHeader>
            <DialogTitle className="text-xl text-theme-primary">
              {t('suggestions.title')}
            </DialogTitle>
            <DialogDescription className="text-sm text-theme-secondary">
              {t('suggestions.foundCount', { count: suggestions.length })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {order.map(
              (type) =>
                grouped[type]?.length > 0 && (
                  <section key={type} className="space-y-2">
                    <h3 className="text-md font-semibold text-theme-primary">
                      {t(TYPE_LABEL_KEYS[type] || 'suggestions.typeOther')} ({grouped[type].length})
                    </h3>
                    <div
                      className={`rounded-lg border p-3 space-y-3 ${TYPE_SECTION_CLASSES[type] || ''}`}
                    >
                      {grouped[type].map((s) => {
                        return (
                          <div
                            key={s.component_id}
                            className="flex items-start gap-3 p-3 rounded-lg bg-theme-surface border border-theme"
                          >
                            <Checkbox
                              id={`suggestion-${s.component_id}`}
                              checked={selectedIds.has(s.component_id)}
                              onCheckedChange={() => toggleOne(s.component_id)}
                              className="mt-0.5 border-theme data-[state=checked]:bg-[var(--color-primary)] data-[state=checked]:border-[var(--color-primary)]"
                              aria-label={t('suggestions.checkboxAria', { name: s.component_name })}
                            />
                            <div className="flex-1 min-w-0">
                              <label
                                htmlFor={`suggestion-${s.component_id}`}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                {s.component_type && (
                                  <ComponentIcon
                                    type={s.component_type}
                                    className="h-6 w-6 text-theme-secondary"
                                  />
                                )}
                                <span className="font-mono font-semibold text-theme-primary">
                                  {s.component_name}
                                </span>
                                {s.component_type && (
                                  <span className="px-2 py-0.5 rounded text-xs font-medium uppercase bg-theme-elevated text-theme-secondary border border-theme">
                                    {s.component_type}
                                  </span>
                                )}
                                {s.estimated_tokens && (
                                  <span className="text-sm text-theme-tertiary font-mono ml-auto shrink-0">
                                    ~{s.estimated_tokens.toLocaleString()} tokens
                                  </span>
                                )}
                              </label>
                              <p className="mt-1 text-sm text-theme-secondary">
                                {t('suggestions.reason')} {s.reason}
                              </p>
                              <div className="mt-2 flex gap-2">
                                <span className="text-xs text-theme-tertiary">
                                  {t('suggestions.action')}{' '}
                                  <span className="font-semibold">{s.action}</span>
                                  {s.priority && (
                                    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                                      s.priority === 'high' ? 'badge-theme-danger' :
                                      s.priority === 'medium' ? 'badge-theme-warning' :
                                      'badge-theme-muted'
                                    }`}>
                                      {s.priority}
                                    </span>
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-theme">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="px-3 py-1.5 rounded-lg btn-theme-surface text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
              >
                {t('suggestions.selectAll')}
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="px-3 py-1.5 rounded-lg btn-theme-surface text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
              >
                {t('suggestions.deselectAll')}
              </button>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg btn-theme-surface transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
              >
                {t('suggestions.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDisableClick}
                disabled={selectedIds.size === 0 || isPending}
                className="px-4 py-2 rounded-lg btn-theme-primary-soft disabled:opacity-50 disabled:cursor-not-allowed text-theme-primary font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
              >
                {isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-fg-primary)] border-t-transparent" />
                    {t('suggestions.disabling')}
                  </span>
                ) : (
                  t('suggestions.disableSelected', { count: selectedIds.size })
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="bg-theme-surface border-theme text-theme-primary">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-theme-primary">
              {t('suggestions.confirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-theme-secondary">
              {t('suggestions.confirmDesc', { count: selectedIds.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setShowConfirm(false)}
              className="btn-theme-surface"
            >
              {t('suggestions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDisable}
              className="btn-theme-danger-soft text-theme-primary"
            >
              {t('suggestions.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
