import { useState, useEffect } from 'react';
import { api, JournalEntry } from '../services/api';
import { Plus, Trash2 } from 'lucide-react';

type CategoryFilter = '' | 'voice' | 'build' | 'reference';
type EntryTypeFilter = '' | 'journal' | 'field-note' | 'calibration';

export default function Journal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('');
  const [typeFilter, setTypeFilter] = useState<EntryTypeFilter>('');
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<'voice' | 'build' | 'reference'>('voice');
  const [newType, setNewType] = useState<'journal' | 'field-note' | 'calibration'>('journal');
  const [newTags, setNewTags] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadEntries();
  }, [categoryFilter, typeFilter]);

  async function loadEntries() {
    try {
      setIsLoading(true);
      const params: Record<string, string> = {};
      if (categoryFilter) params.category = categoryFilter;
      if (typeFilter) params.entryType = typeFilter;

      const data = await api.journal.list(params as any);
      setEntries(data);
    } catch (error) {
      console.error('Error loading journal entries:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    try {
      setIsCreating(true);
      const entry: JournalEntry = {
        title: newTitle,
        content: newContent,
        category: newCategory,
        entryType: newType,
        tags: newTags
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0),
      };

      const created = await api.journal.create(entry);
      setEntries([created, ...entries]);
      setSelectedEntry(created);
      setNewTitle('');
      setNewContent('');
      setNewCategory('voice');
      setNewType('journal');
      setNewTags('');
    } catch (error) {
      console.error('Error creating entry:', error);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteEntry(id: string) {
    if (!confirm('Delete this entry?')) return;

    try {
      await api.journal.delete(id);
      setEntries(entries.filter((e) => e.id !== id));
      if (selectedEntry?.id === id) {
        setSelectedEntry(null);
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  }

  const filteredEntries = entries.filter((entry) => {
    if (categoryFilter && entry.category !== categoryFilter) return false;
    if (typeFilter && entry.entryType !== typeFilter) return false;
    return true;
  });

  const categoryColors: Record<string, string> = {
    voice: 'bg-vale-shadow text-white',
    build: 'bg-vale-accent text-white',
    reference: 'bg-vale-growth text-white',
  };

  const typeColors: Record<string, string> = {
    journal: 'bg-vale-cyan text-white',
    'field-note': 'bg-vale-deep text-white',
    calibration: 'bg-vale-growth text-white',
  };

  return (
    <div className="flex h-full">
      {/* Left Panel - Entry List */}
      <div className="w-80 bg-vale-surface border-r border-vale-border flex flex-col overflow-y-auto">
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold text-vale-text">Journal</h1>

          {/* Filters */}
          <div className="space-y-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
              className="w-full px-3 py-2 bg-vale-card border border-vale-border rounded text-vale-text text-sm"
            >
              <option value="">All Categories</option>
              <option value="voice">Voice</option>
              <option value="build">Build</option>
              <option value="reference">Reference</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as EntryTypeFilter)}
              className="w-full px-3 py-2 bg-vale-card border border-vale-border rounded text-vale-text text-sm"
            >
              <option value="">All Types</option>
              <option value="journal">Journal</option>
              <option value="field-note">Field Note</option>
              <option value="calibration">Calibration</option>
            </select>
          </div>

          {/* Create Entry Form */}
          <form onSubmit={handleCreateEntry} className="pt-4 border-t border-vale-border space-y-3">
            <h3 className="font-semibold text-vale-text text-sm">New Entry</h3>

            <input
              type="text"
              placeholder="Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 bg-vale-card border border-vale-border rounded text-sm"
            />

            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as any)}
              className="w-full px-3 py-2 bg-vale-card border border-vale-border rounded text-sm"
            >
              <option value="voice">Voice</option>
              <option value="build">Build</option>
              <option value="reference">Reference</option>
            </select>

            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as any)}
              className="w-full px-3 py-2 bg-vale-card border border-vale-border rounded text-sm"
            >
              <option value="journal">Journal</option>
              <option value="field-note">Field Note</option>
              <option value="calibration">Calibration</option>
            </select>

            <button
              type="submit"
              disabled={isCreating}
              className="w-full px-3 py-2 bg-vale-accent hover:bg-opacity-90 text-white rounded font-medium text-sm transition-colors disabled:opacity-50"
            >
              <Plus className="inline w-4 h-4 mr-1" />
              Create Entry
            </button>
          </form>
        </div>

        {/* Entry List */}
        <div className="flex-1 px-6 pb-6 space-y-2 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-vale-card rounded animate-pulse" />
              ))}
            </div>
          ) : filteredEntries.length > 0 ? (
            filteredEntries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setSelectedEntry(entry)}
                className={`w-full text-left p-3 rounded transition-colors ${
                  selectedEntry?.id === entry.id
                    ? 'bg-vale-accent text-white'
                    : 'bg-vale-card hover:bg-vale-border text-vale-text'
                }`}
              >
                <p className="font-medium line-clamp-1">{entry.title}</p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded ${categoryColors[entry.category]}`}>
                    {entry.category}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${typeColors[entry.entryType]}`}>
                    {entry.entryType}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <p className="text-center text-vale-muted py-8">No entries found</p>
          )}
        </div>
      </div>

      {/* Right Panel - Entry Detail */}
      <div className="flex-1 p-8 overflow-y-auto">
        {selectedEntry ? (
          <div className="space-y-6">
            {/* Entry Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-3xl font-bold text-vale-text">{selectedEntry.title}</h2>
                {selectedEntry.timestamp && (
                  <p className="text-vale-muted text-sm mt-1">
                    {new Date(selectedEntry.timestamp).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  if (selectedEntry.id) {
                    handleDeleteEntry(selectedEntry.id);
                  }
                }}
                className="p-2 hover:bg-vale-surface rounded transition-colors text-vale-cyan"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            {/* Metadata */}
            <div className="flex flex-wrap gap-2">
              <span className={`text-xs px-3 py-1 rounded font-medium ${categoryColors[selectedEntry.category]}`}>
                {selectedEntry.category}
              </span>
              <span className={`text-xs px-3 py-1 rounded font-medium ${typeColors[selectedEntry.entryType]}`}>
                {selectedEntry.entryType}
              </span>
              {selectedEntry.tags && selectedEntry.tags.length > 0 && (
                <div className="flex gap-2">
                  {selectedEntry.tags.map((tag) => (
                    <span key={tag} className="text-xs px-3 py-1 rounded bg-vale-card text-vale-text">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="bg-vale-card rounded p-6 border border-vale-border min-h-60">
              <p className="text-vale-text whitespace-pre-wrap">{selectedEntry.content}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-vale-muted text-lg">Select an entry to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
