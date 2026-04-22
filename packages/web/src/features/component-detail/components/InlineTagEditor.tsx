import { useState, useRef, type KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';

interface InlineTagEditorProps {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  isSaving?: boolean;
}

export function InlineTagEditor({ tags, onAdd, onRemove, isSaving = false }: InlineTagEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTag, setNewTag] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onAdd(trimmed);
    }
    setNewTag('');
    setIsAdding(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
    if (e.key === 'Escape') { setNewTag(''); setIsAdding(false); }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <span
          key={tag}
          className="group inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium badge-theme-info"
        >
          {tag}
          <button
            onClick={() => onRemove(tag)}
            disabled={isSaving}
            className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-theme-danger"
            aria-label={`Remove tag ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {isAdding ? (
        <input
          ref={inputRef}
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onBlur={handleAdd}
          onKeyDown={handleKeyDown}
          className="px-2 py-1 text-xs rounded-full border border-theme bg-theme-elevated text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary w-24"
          placeholder="tag name"
          autoFocus
          disabled={isSaving}
        />
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          disabled={isSaving}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border border-dashed border-theme text-theme-tertiary hover:text-theme-primary hover:border-theme-hover transition-colors"
          aria-label="Add tag"
        >
          <Plus className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
