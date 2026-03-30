import { useState, useEffect } from 'react';
import { api, Entity, Identity, ObservationEntry } from '../services/api';
import { Plus, Search, Trash2, Brain, ChevronDown, ChevronRight, User, Layers, X, Save } from 'lucide-react';

type SalienceFilter = '' | 'foundational' | 'active-immediate' | 'active-recent' | 'background' | 'archive';
type ContextFilter = '' | 'default' | 'emotional' | 'relational' | 'episodic' | 'creative' | 'intimate';
type ViewMode = 'list' | 'salience';
type DetailView = 'entity' | 'identity';

const SALIENCE_LEVELS = [
  { key: 'foundational', label: 'Foundational', color: 'text-vale-mint' },
  { key: 'active-immediate', label: 'Active-Immediate', color: 'text-vale-cyan' },
  { key: 'active-recent', label: 'Active-Recent', color: 'text-vale-pink' },
  { key: 'background', label: 'Background', color: 'text-vale-muted' },
  { key: 'archive', label: 'Archive', color: 'text-vale-muted opacity-60' },
];

export default function Memory() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [salienceFilter, setSalienceFilter] = useState<SalienceFilter>('');
  const [contextFilter, setContextFilter] = useState<ContextFilter>('');
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('salience');
  const [salienceCounts, setSalienceCounts] = useState<Record<string, number>>({});
  const [expandedSalience, setExpandedSalience] = useState<string[]>(['foundational', 'active-immediate']);

  // Identity state
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loadingIdentity, setLoadingIdentity] = useState(false);
  const [showNewIdentity, setShowNewIdentity] = useState(false);
  const [selectedPerspective, setSelectedPerspective] = useState<string | null>(null);
  const [submittingIdentity, setSubmittingIdentity] = useState(false);

  // New identity form fields
  const [newIdPerspective, setNewIdPerspective] = useState('Theo');
  const [newIdCategory, setNewIdCategory] = useState('');
  const [newIdKey, setNewIdKey] = useState('');
  const [newIdValue, setNewIdValue] = useState('');

  // Detail view mode
  const [detailView, setDetailView] = useState<DetailView>('entity');

  // Entity form states
  const [newEntityName, setNewEntityName] = useState('');
  const [newEntityType, setNewEntityType] = useState('person');
  const [newObservation, setNewObservation] = useState('');
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);
  const [isAddingObservation, setIsAddingObservation] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Mobile detail view
  const [showDetail, setShowDetail] = useState(false);

  // Load all data in parallel on mount and filter change
  useEffect(() => {
    loadAll();
  }, [salienceFilter, contextFilter]);

  async function loadAll() {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (salienceFilter) params.salience = salienceFilter;
      if (contextFilter) params.context = contextFilter;

      const [entitiesData, identityData, countsData] = await Promise.all([
        api.entities.list(params as any).catch(() => [] as Entity[]),
        api.identity.get().catch(() => [] as Identity[]),
        api.entities.salienceCounts().catch(() => ({} as Record<string, number>)),
      ]);

      setEntities(entitiesData);
      setIdentities(Array.isArray(identityData) ? identityData : identityData ? [identityData] : []);
      setSalienceCounts(countsData);
    } catch (error) {
      console.error('Error loading memory data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // Load identities when identity tab is selected and entity is selected
  useEffect(() => {
    if (detailView === 'identity' && selectedPerspective) {
      loadIdentities();
    }
  }, [detailView, selectedPerspective]);

  // Individual loaders for post-mutation refresh
  async function loadEntities() {
    const params: Record<string, string> = {};
    if (salienceFilter) params.salience = salienceFilter;
    if (contextFilter) params.context = contextFilter;
    const data = await api.entities.list(params as any).catch(() => []);
    setEntities(data);
  }

  async function loadIdentities() {
    setLoadingIdentity(true);
    try {
      const data = await api.identity.get(selectedPerspective || undefined);
      setIdentities(Array.isArray(data) ? data : data ? [data] : []);
    } catch (err) {
      console.error('Error loading identities:', err);
      setIdentities([]);
    } finally {
      setLoadingIdentity(false);
    }
  }

  async function loadSalienceCounts() {
    const counts = await api.entities.salienceCounts().catch(() => ({}));
    setSalienceCounts(counts);
  }

  const filteredEntities = entities.filter((entity) =>
    entity.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group entities by salience for salience view
  const entitiesBySalience: Record<string, Entity[]> = {};
  for (const level of SALIENCE_LEVELS) {
    entitiesBySalience[level.key] = filteredEntities.filter(
      (e) => (e.salience || 'background') === level.key
    );
  }

  function toggleSalience(key: string) {
    setExpandedSalience((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  // Group identities by perspective
  const identitiesByPerspective: Record<string, Identity[]> = {};
  for (const id of identities) {
    const perspective = id.owner_perspective || 'default';
    if (!identitiesByPerspective[perspective]) {
      identitiesByPerspective[perspective] = [];
    }
    identitiesByPerspective[perspective].push(id);
  }

  // Group a perspective's identities by category
  function groupByCategory(ids: Identity[]): Record<string, Identity[]> {
    const grouped: Record<string, Identity[]> = {};
    for (const id of ids) {
      const cat = id.category || 'uncategorized';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(id);
    }
    return grouped;
  }

  function handleSelectPerspective(perspective: string) {
    setSelectedPerspective(perspective);
    setDetailView('identity');
    setSelectedEntity(null);
    setShowDetail(true);
  }

  async function handleCreateEntity(e: React.FormEvent) {
    e.preventDefault();
    if (!newEntityName.trim()) return;

    try {
      setIsCreatingEntity(true);
      const newEntity: Entity = {
        name: newEntityName,
        type: newEntityType,
        observations: [],
      };

      const created = await api.entities.create(newEntity);
      setEntities([created, ...entities]);
      setSelectedEntity(created);
      setNewEntityName('');
      setNewEntityType('person');
      setShowCreateForm(false);
      setDetailView('entity');
      setShowDetail(true);
      loadSalienceCounts();
    } catch (error) {
      console.error('Error creating entity:', error);
    } finally {
      setIsCreatingEntity(false);
    }
  }

  async function handleAddObservation(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEntity || !newObservation.trim()) return;

    try {
      setIsAddingObservation(true);
      const observation = {
        entityName: selectedEntity.name,
        observation: newObservation.trim(),
      };

      await api.observations.create(observation);
      setNewObservation('');
      await loadEntities();
    } catch (error) {
      console.error('Error adding observation:', error);
    } finally {
      setIsAddingObservation(false);
    }
  }

  async function handleDeleteEntity(name: string) {
    if (!confirm(`Delete "${name}" and all related data?`)) return;

    try {
      await api.entities.delete(name);
      setEntities((prev) => prev.filter((e) => e.name !== name));
      setSelectedEntity(null);
      loadSalienceCounts();
    } catch (error) {
      console.error('Error deleting entity:', error);
    }
  }

  async function handleSaveIdentity(e: React.FormEvent) {
    e.preventDefault();
    if (!newIdPerspective.trim() || !newIdKey.trim() || !newIdValue.trim()) return;

    try {
      setSubmittingIdentity(true);
      await api.identity.set({
        owner_perspective: newIdPerspective,
        key: newIdKey,
        value: newIdValue,
        category: newIdCategory || undefined,
      });
      await loadIdentities();
      setNewIdKey('');
      setNewIdValue('');
      setNewIdCategory('');
      setShowNewIdentity(false);
    } catch (error) {
      console.error('Error saving identity:', error);
    } finally {
      setSubmittingIdentity(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-vale-muted">Loading memory...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4 p-4 sm:p-6">
      {/* Left Sidebar - Entity List */}
      <div className={`${showDetail ? 'hidden' : 'flex'} lg:flex flex-col w-full lg:w-80 gap-4`}>
        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-vale-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entities..."
              className="w-full pl-10 pr-3 py-2 bg-vale-surface border border-vale-border rounded-lg text-vale-text text-sm placeholder-vale-muted focus:outline-none focus:border-vale-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={salienceFilter}
              onChange={(e) => setSalienceFilter(e.target.value as SalienceFilter)}
              className="px-3 py-2 bg-vale-surface border border-vale-border rounded-lg text-vale-text text-xs focus:outline-none focus:border-vale-accent"
            >
              <option value="">All Salience</option>
              {SALIENCE_LEVELS.map((level) => (
                <option key={level.key} value={level.key}>
                  {level.label}
                </option>
              ))}
            </select>

            <select
              value={contextFilter}
              onChange={(e) => setContextFilter(e.target.value as ContextFilter)}
              className="px-3 py-2 bg-vale-surface border border-vale-border rounded-lg text-vale-text text-xs focus:outline-none focus:border-vale-accent"
            >
              <option value="">All Contexts</option>
              <option value="default">Default</option>
              <option value="emotional">Emotional</option>
              <option value="relational">Relational</option>
              <option value="episodic">Episodic</option>
              <option value="creative">Creative</option>
              <option value="intimate">Intimate</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('salience')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'salience'
                  ? 'bg-vale-accent text-white'
                  : 'bg-vale-surface border border-vale-border text-vale-text hover:border-vale-accent'
              }`}
            >
              By Salience
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-vale-accent text-white'
                  : 'bg-vale-surface border border-vale-border text-vale-text hover:border-vale-accent'
              }`}
            >
              List View
            </button>
          </div>

          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="w-full px-4 py-2.5 bg-vale-accent hover:bg-vale-accent/90 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Entity
          </button>
        </div>

        {/* Create Entity Form */}
        {showCreateForm && (
          <div className="bg-vale-surface border border-vale-border rounded-lg p-4 space-y-2">
            <form onSubmit={handleCreateEntity} className="space-y-2">
              <input
                type="text"
                value={newEntityName}
                onChange={(e) => setNewEntityName(e.target.value)}
                placeholder="Entity name"
                className="w-full px-3 py-1.5 bg-vale-card border border-vale-border rounded text-sm text-vale-text placeholder-vale-muted"
              />
              <select
                value={newEntityType}
                onChange={(e) => setNewEntityType(e.target.value)}
                className="w-full px-3 py-1.5 bg-vale-card border border-vale-border rounded text-sm text-vale-text"
              >
                <option value="person">Person</option>
                <option value="place">Place</option>
                <option value="concept">Concept</option>
                <option value="event">Event</option>
                <option value="object">Object</option>
              </select>
              <button
                type="submit"
                disabled={isCreatingEntity}
                className="w-full px-3 py-1.5 bg-vale-deep hover:bg-vale-deep/80 text-white rounded font-medium text-xs transition-colors disabled:opacity-50"
              >
                {isCreatingEntity ? 'Creating...' : 'Create'}
              </button>
            </form>
          </div>
        )}

        {/* Entity List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {viewMode === 'salience' ? (
            <div className="space-y-3">
              {SALIENCE_LEVELS.map((level) => {
                const count = entitiesBySalience[level.key].length;
                if (count === 0) return null;

                return (
                  <div key={level.key}>
                    <button
                      onClick={() => toggleSalience(level.key)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        expandedSalience.includes(level.key)
                          ? 'bg-vale-surface text-vale-text'
                          : 'text-vale-muted hover:text-vale-text'
                      }`}
                    >
                      <span className={`${level.color}`}>{level.label}</span>
                      <span className="text-xs">{count}</span>
                    </button>

                    {expandedSalience.includes(level.key) && (
                      <div className="mt-1 space-y-1 pl-2 border-l border-vale-border">
                        {entitiesBySalience[level.key].map((entity) => (
                          <button
                            key={entity.name}
                            onClick={() => {
                              setSelectedEntity(entity);
                              setDetailView('entity');
                              setShowDetail(true);
                            }}
                            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                              selectedEntity?.name === entity.name && detailView === 'entity'
                                ? 'bg-vale-accent/20 text-vale-accent border border-vale-accent/30'
                                : 'hover:bg-vale-border text-vale-text'
                            }`}
                          >
                            {entity.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredEntities.map((entity) => (
                <button
                  key={entity.name}
                  onClick={() => {
                    setSelectedEntity(entity);
                    setDetailView('entity');
                    setShowDetail(true);
                  }}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedEntity?.name === entity.name && detailView === 'entity'
                      ? 'bg-vale-accent/20 text-vale-accent border border-vale-accent/30'
                      : 'hover:bg-vale-border text-vale-text'
                  }`}
                >
                  {entity.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Perspectives/Identity Quick Access */}
        <div className="border-t border-vale-border pt-3">
          <p className="text-xs font-bold text-vale-muted uppercase tracking-wider mb-2">Perspectives</p>
          <div className="space-y-1">
            {['Theo', 'Arden', 'System'].map((perspective) => (
              <button
                key={perspective}
                onClick={() => handleSelectPerspective(perspective)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  selectedPerspective === perspective && detailView === 'identity'
                    ? 'bg-vale-accent/20 text-vale-accent border border-vale-accent/30'
                    : 'hover:bg-vale-border text-vale-text'
                }`}
              >
                <span className="font-semibold">{perspective}</span>
                <span className="text-[10px] text-vale-muted ml-2">
                  {identitiesByPerspective[perspective]?.length || 0} values
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Detail Panel */}
      <div className={`${showDetail ? 'flex' : 'hidden'} lg:flex flex-col flex-1 gap-4`}>
        {/* Back Button for Mobile */}
        <button
          onClick={() => setShowDetail(false)}
          className="lg:hidden px-4 py-2 bg-vale-surface border border-vale-border rounded-lg text-vale-text text-sm hover:bg-vale-border transition-colors"
        >
          Back to List
        </button>

        {/* Detail Content */}
        {detailView === 'identity' && selectedPerspective ? (
          /* Identity Detail View */
          <div className="flex-1 overflow-y-auto bg-vale-surface rounded-lg border border-vale-border p-6 space-y-6">
            <div className="flex items-center gap-3">
              <User className="w-7 h-7" style={{ color: selectedPerspective === 'Theo' ? '#d4a847' : selectedPerspective === 'Arden' ? '#e5a0b4' : '#7a8ba8' }} />
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold" style={{ color: selectedPerspective === 'Theo' ? '#d4a847' : selectedPerspective === 'Arden' ? '#e5a0b4' : '#7a8ba8' }}>
                  {selectedPerspective}
                </h2>
                <p className="text-vale-muted text-xs">Identity data and attributes</p>
              </div>
            </div>

            {loadingIdentity ? (
              <p className="text-vale-muted text-sm">Loading identities...</p>
            ) : identities.length === 0 ? (
              <p className="text-vale-muted text-sm">No identity values yet. Create one below.</p>
            ) : (
              <>
                {/* Identity entries grouped by category */}
                {(() => {
                  const perspectiveIds = identities.filter((id) => id.owner_perspective === selectedPerspective);
                  if (perspectiveIds.length === 0) {
                    return <p className="text-vale-muted text-sm">No values for this perspective.</p>;
                  }

                  const byCategory = groupByCategory(perspectiveIds);

                  return Object.entries(byCategory).map(([category, entries]) => (
                    <div key={category}>
                      <h3 className="text-xs font-bold text-vale-muted uppercase tracking-wider mb-3">{category}</h3>
                      <div className="space-y-2">
                        {entries.map((entry, idx) => (
                          <div
                            key={idx}
                            className="bg-vale-card border border-vale-border rounded-lg p-3"
                            style={{ borderLeftColor: selectedPerspective === 'Theo' ? '#d4a847' : selectedPerspective === 'Arden' ? '#e5a0b4' : '#7a8ba8', borderLeftWidth: '3px' }}
                          >
                            <p className="text-[10px] font-medium mb-1" style={{ color: selectedPerspective === 'Theo' ? '#d4a847' : selectedPerspective === 'Arden' ? '#e5a0b4' : '#34bed6' }}>
                              {entry.key}
                            </p>
                            <p className="text-sm text-vale-text whitespace-pre-wrap">{entry.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </>
            )}

            {/* Add Identity Form */}
            <div className="border-t border-vale-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-vale-text">Add to {selectedPerspective}</h3>
                <button
                  onClick={() => setShowNewIdentity(!showNewIdentity)}
                  className="text-xs text-vale-accent hover:text-vale-accent/80"
                >
                  {showNewIdentity ? 'Cancel' : 'Add New'}
                </button>
              </div>

              {showNewIdentity && (
                <form onSubmit={handleSaveIdentity} className="space-y-2">
                  <input
                    type="text"
                    value={newIdCategory}
                    onChange={(e) => setNewIdCategory(e.target.value)}
                    placeholder="Category (optional)"
                    className="w-full px-3 py-1.5 bg-vale-card border border-vale-border rounded text-sm text-vale-text placeholder-vale-muted"
                  />
                  <input
                    type="text"
                    value={newIdKey}
                    onChange={(e) => setNewIdKey(e.target.value)}
                    placeholder="Key"
                    required
                    className="w-full px-3 py-1.5 bg-vale-card border border-vale-border rounded text-sm text-vale-text placeholder-vale-muted"
                  />
                  <textarea
                    value={newIdValue}
                    onChange={(e) => setNewIdValue(e.target.value)}
                    placeholder="Value"
                    required
                    className="w-full px-3 py-1.5 bg-vale-card border border-vale-border rounded text-sm text-vale-text placeholder-vale-muted h-20 resize-none"
                  />
                  <button
                    type="submit"
                    disabled={submittingIdentity || !newIdKey.trim() || !newIdValue.trim()}
                    className="w-full px-4 py-1.5 bg-vale-deep hover:bg-vale-deep/80 text-white rounded font-medium text-xs transition-colors disabled:opacity-50"
                  >
                    {submittingIdentity ? 'Saving...' : 'Save'}
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : selectedEntity && detailView === 'entity' ? (
          /* Entity Detail View */
          <div className="flex-1 overflow-y-auto bg-vale-surface rounded-lg border border-vale-border p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-vale-text">{selectedEntity.name}</h2>
                <p className="text-vale-muted text-sm">{selectedEntity.entity_type || selectedEntity.type}</p>
              </div>
              <button
                onClick={() => handleDeleteEntity(selectedEntity.name)}
                className="p-2 hover:bg-vale-surface rounded-lg transition-colors text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              {selectedEntity.salience && (
                <div className="bg-vale-card rounded-lg px-3 py-2 border border-vale-border">
                  <p className="text-[10px] text-vale-muted uppercase">Salience</p>
                  <p className="text-sm font-medium text-vale-text">{selectedEntity.salience}</p>
                </div>
              )}
              {selectedEntity.context && (
                <div className="bg-vale-card rounded-lg px-3 py-2 border border-vale-border">
                  <p className="text-[10px] text-vale-muted uppercase">Context</p>
                  <p className="text-sm font-medium text-vale-text">{selectedEntity.context}</p>
                </div>
              )}
              {selectedEntity.visibility && (
                <div className="bg-vale-card rounded-lg px-3 py-2 border border-vale-border">
                  <p className="text-[10px] text-vale-muted uppercase">Visibility</p>
                  <p className="text-sm font-medium text-vale-text">{selectedEntity.visibility}</p>
                </div>
              )}
            </div>

            {/* Observations */}
            <div>
              <h3 className="text-sm font-bold text-vale-muted uppercase tracking-wider mb-3">Observations</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {selectedEntity.observations && selectedEntity.observations.length > 0 ? (
                  selectedEntity.observations.map((obs, idx) => {
                    const content = typeof obs === 'string' ? obs : (obs as ObservationEntry).content;
                    return (
                      <div key={idx} className="bg-vale-card border border-vale-border rounded-lg p-3">
                        <p className="text-sm text-vale-text whitespace-pre-wrap">{content}</p>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-vale-muted">No observations yet.</p>
                )}
              </div>
            </div>

            {/* Add Observation */}
            <div className="border-t border-vale-border pt-4">
              <form onSubmit={handleAddObservation} className="space-y-2">
                <textarea
                  value={newObservation}
                  onChange={(e) => setNewObservation(e.target.value)}
                  placeholder="Add an observation..."
                  className="w-full px-3 py-2 bg-vale-card border border-vale-border rounded text-sm text-vale-text placeholder-vale-muted h-16 resize-none"
                />
                <button
                  type="submit"
                  disabled={isAddingObservation || !newObservation.trim()}
                  className="w-full px-4 py-1.5 bg-vale-deep hover:bg-vale-deep/80 text-white rounded font-medium text-xs transition-colors disabled:opacity-50"
                >
                  {isAddingObservation ? 'Adding...' : 'Add Observation'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-vale-surface rounded-lg border border-vale-border">
            <p className="text-vale-muted text-sm">Select an entity or perspective to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       