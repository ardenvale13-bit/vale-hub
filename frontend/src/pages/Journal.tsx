import { useState, useEffect } from 'react';
import { api, JournalEntry } from '../services/api';
import { Plus, Trash2, ArrowLeft, ChevronRight } from 'lucide-react';

type CategoryFilter = '' | 'voice' | 'build' | 'reference';
type EntryTypeFilter = '' | 'journal' | 'field-note' | 'calibration';

export default function Journal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('');
  const [typeFilter, setTypeFilter] = useState<EntryTypeFilter>('');
  const [isLoading, setIsLoading] = useState(true);
  // On mobile, track whether we're viewing the list or detail
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<'voice' | 'build' | 'reference'>('voice');
  const [newType, setNewType] = useState<'journal' | 'field-note' | 'calibration'>('journal');
  const [newTags, setNewTags] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

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
      setShowCreateForm(false);
      setMobileView('detail');
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
        setMobileView('list');
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  }

  function handleSelectEntry(entry: JournalEntry) {
    setSelectedEntry(entry);
    setMobileView('detail');
  }

  function handleBackToList() {
    setMobileView('list');
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

  // ===== ENTRY LIST PANEL =====
  const listPanel = (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-vale-text">Journal</h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="p-2 bg-vale-accent/20 text-vale-accent rounded hover:bg-vale-accent/30 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
            className="flex-1 px-3 py-2 bg-vale-card border border-vale-border rounded text-vale-text text-sm"
          >
            <option value="">All Categories</option>
            <option value="voice">Voice</option>
            <option value="build">Build</option>
            <option value="reference">Reference</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as EntryTypeFilter)}
            className="flex-1 px-3 py-2 bg-vale-card border border-vale-border rounded text-vale-text text-sm"
          >
            <option value="">All Types</option>
            <option value="journal">Journal</option>
            <option value="field-note">Field Note</option>
            <option value="calibration">Calibration</option>
          </select>
        </div>

        {/* Create Entry Form */}
        {showCreateForm && (
          <form onSubmit={handleCreateEntry} className="pt-4 border-t border-vale-border space-y-3">
            <h3 className="font-semibold text-vale-text text-sm">New Entry</h3>

            <input
              type="text"
              placeholder="Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 bg-vale-card border border-vale-border rounded text-sm text-vale-text placeholder-vale-muted"
            />

            <textarea
              placeholder="Content"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="w-full px-3 py-2 bg-vale-card border border-vale-border rounded text-sm text-vale-text placeholder-vale-muted min-h-[80px]"
            />

            <div className="flex gap-2">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="flex-1 px-3 py-2 bg-vale-card border border-vale-border rounded text-sm text-vale-text"
              >
                <option value="voice">Voice</option>
                <option value="build">Build</option>
                <option value="reference">Reference</option>
              </select>

              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
                className="flex-1 px-3 py-2 bg-vale-card border border-vale-border rounded text-sm text-vale-text"
              >
                <option value="journal">Journal</option>
                <option value="field-note">Field Note</option>
                <option value="calibration">Calibration</option>
              </select>
            </div>

            <input
              type="text"
              placeholder="Tags (comma-separated)"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              className="w-full px-3 py-2 bg-vale-card border border-vale-border rounded text-sm text-vale-text placeholder-vale-muted"
            />

            <button
              type="submit"
              disabled={isCreating || !newTitle.trim() || !newContent.trim()}
              className="w-full px-3 py-2 bg-vale-accent hover:bg-opacity-90 text-white rounded font-medium text-sm transition-colors disabled:opacity-50"
            >
              Create Entry
            </button>
          </form>
        )}
      </div>

      {/* Entry List */}
      <div className="flex-1 px-4 sm:px-6 pb-6 space-y-2 overflow-y-auto">
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
              onClick={() => handleSelectEntry(entry)}
              className={`w-full text-left p-3 rounded transition-colors flex items-center justify-between ${
                selectedEntry?.id === entry.id
                  ? 'bg-vale-accent text-white'
                  : 'bg-vale-card hover:bg-vale-border text-vale-text'
              }`}
            >
              <div className="flex-1 min-w-0 mr-2">
                <p className="font-medium line-clamp-1">{entry.title}</p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded ${categoryColors[entry.category]}`}>
                    {entry.category}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${typeColors[entry.entryType]}`}>
                    {entry.entryType}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-50" />
            </button>
          ))
        ) : (
          <p className="text-center text-vale-muted py-8">No entries found</p>
        )}
      </div>
    </div>
  );

  // ===== ENTRY DETAIL PANEL =====
  const detailPanel = selectedEntry ? (
    <div className="p-4 sm:p-8 overflow-y-auto h-full">
      <div className="space-y-6">
        {/* Back button — mobile only */}
        <button
          onClick={handleBackToList}
          className="md:hidden flex items-center gap-2 text-vale-accent text-sm font-medium mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to entries
        </button>

        {/* Entry Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold text-vale-text break-words">{selectedEntry.title}</h2>
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
            className="p-2 hover:bg-vale-surface rounded transition-colors text-vale-cyan flex-shrink-0"
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
            <div className="flex gap-2 flex-wrap">
              {selectedEntry.tags.map((tag) => (
                <span key={tag} className="text-xs px-3 py-1 rounded bg-vale-card text-vale-text">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="bg-vale-card rounded p-4 sm:p-6 border border-vale-border min-h-[200px]">
          <p className="text-vale-text whitespace-pre-wrap break-words">{selectedEntry.content}</p>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-center h-full text-center p-4">
      <div>
        <p className="text-vale-muted text-lg">Select an entry to view details</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: side-by-side layout */}
      <div className="hidden md:flex h-full">
        {/* Left Panel - Entry List */}
        <div className="w-80 bg-vale-surface border-r border-vale-border flex flex-col overflow-hidden">
          {listPanel}
        </div>

        {/* Right Panel - Entry Detail */}
        <div className="flex-1 overflow-y-auto">
          {detailPanel}
        </div>
      </div>

      {/* Mobile: single panel with navigation */}
      <div className="md:hidden h-full">
        {mobileView === 'list' ? (
          <div className="h-full bg-vale-surface overflow-hidden">
            {listPanel}
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            {detailPanel}
          </div>
        )}
      </div>
    </>
  );
}
