import { useState, useEffect } from 'react';
import { api, Entity, Identity } from '../services/api';
import { Plus, Search, Trash2, Brain, ChevronDown, ChevronRight, User, Layers } from 'lucide-react';

type SalienceFilter = '' | 'foundational' | 'active-immediate' | 'active-recent' | 'background' | 'archive';
type ContextFilter = '' | 'default' | 'emotional' | 'relational' | 'episodic' | 'creative' | 'intimate';
type ViewMode = 'list' | 'salience';

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
  const [identityExpanded, setIdentityExpanded] = useState(true);

  // Form states
  const [newEntityName, setNewEntityName] = useState('');
  const [newEntityType, setNewEntityType] = useState('person');
  const [newObservation, setNewObservation] = useState('');
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);
  const [isAddingObservation, setIsAddingObservation] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Mobile detail view
  const [showDetail, setShowDetail] = useState(false);

  // Load entities and identity
  useEffect(() => {
    loadEntities();
    loadIdentity();
    loadSalienceCounts();
  }, [salienceFilter, contextFilter]);

  async function loadEntities() {
    try {
      setIsLoading(true);
      const params: Record<string, string> = {};
      if (salienceFilter) params.salience = salienceFilter;
      if (contextFilter) params.context = contextFilter;

      const data = await api.entities.list(params as any);
      setEntities(data);
    } catch (error) {
      console.error('Error loading entities:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadIdentity() {
    try {
      const data = await api.identity.get();
      setIdentities(Array.isArray(data) ? data : [data]);
    } catch (error) {
      console.error('Error loading identity:', error);
    }
  }

  async function loadSalienceCounts() {
    try {
      const counts = await api.entities.salienceCounts();
      setSalienceCounts(counts);
    } catch (error) {
      console.error('Error loading salience counts:', error);
    }
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
    const perspective = id.perspective || 'default';
    if (!identitiesByPerspective[perspective]) {
      identitiesByPerspective[perspective] = [];
    }
    identitiesByPerspective[perspective].push(id);
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
        observation: newObservation,
      };

      await api.observations.create(observation);

      // Reload the selected entity
      const updated = await api.entities.get(selectedEntity.name);
      setSelectedEntity(updated);
      setNewObservation('');
    } catch (error) {
      console.error('Error adding observation:', error);
    } finally {
      setIsAddingObservation(false);
    }
  }

  async function handleDeleteEntity(name: string) {
    if (!confirm(`Delete entity "${name}"?`)) return;

    try {
      await api.entities.delete(name);
      setEntities(entities.filter((e) => e.name !== name));
      if (selectedEntity?.name === name) {
        setSelectedEntity(null);
        setShowDetail(false);
      }
      loadSalienceCounts();
    } catch (error) {
      console.error('Error deleting entity:', error);
    }
  }

  function selectEntity(entity: Entity) {
    setSelectedEntity(entity);
    setShowDetail(true);
  }

  const totalEntities = Object.values(salienceCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Left Panel - Entity List + Identity */}
      <div className={`${showDetail ? 'hidden md:flex' : 'flex'} w-full md:w-96 bg-vale-surface border-r border-vale-border flex-col overflow-y-auto`}>
        <div className="p-4 sm:p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-6 h-6 text-vale-mint" />
              <h1 className="text-xl sm:text-2xl font-bold text-vale-text">Mind</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-vale-muted">{totalEntities} entities</span>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="p-2 bg-vale-accent/20 hover:bg-vale-accent/30 text-vale-accent rounded-lg transition-colors"
                title="New Entity"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-vale-muted" />
            <input
              type="text"
              placeholder="Search entities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-vale-card border border-vale-border rounded-lg text-vale-text placeholder-vale-muted text-sm"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-1 bg-vale-card rounded-lg p-1">
            <button
              onClick={() => setViewMode('salience')}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'salience'
                  ? 'bg-vale-accent/20 text-vale-accent'
                  : 'text-vale-muted hover:text-vale-text'
              }`}
            >
              <Layers className="w-3 h-3 inline mr-1" />
              By Salience
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-vale-accent/20 text-vale-accent'
                  : 'text-vale-muted hover:text-vale-text'
              }`}
            >
              All Entities
            </button>
          </div>

          {/* Filters (list mode) */}
          {viewMode === 'list' && (
            <div className="flex gap-2">
              <select
                value={salienceFilter}
                onChange={(e) => setSalienceFilter(e.target.value as SalienceFilter)}
                className="flex-1 px-2 py-1.5 bg-vale-card border border-vale-border rounded-lg text-vale-text text-xs"
              >
                <option value="">All Salience</option>
                <option value="foundational">Foundational</option>
                <option value="active-immediate">Active Immediate</option>
                <option value="active-recent">Active Recent</option>
                <option value="background">Background</option>
                <option value="archive">Archive</option>
              </select>

              <select
                value={contextFilter}
                onChange={(e) => setContextFilter(e.target.value as ContextFilter)}
                className="flex-1 px-2 py-1.5 bg-vale-card border border-vale-border rounded-lg text-vale-text text-xs"
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
          )}

          {/* Create Entity Form */}
          {showCreateForm && (
            <form onSubmit={handleCreateEntity} className="bg-vale-card border border-vale-border rounded-lg p-3 space-y-2">
              <h3 className="font-semibold text-vale-text text-sm">New Entity</h3>
              <input
                type="text"
                placeholder="Entity name"
                value={newEntityName}
                onChange={(e) => setNewEntityName(e.target.value)}
                className="w-full px-3 py-2 bg-vale-surface border border-vale-border rounded-lg text-sm text-vale-text placeholder-vale-muted"
                autoFocus
              />
              <select
                value={newEntityType}
                onChange={(e) => setNewEntityType(e.target.value)}
                className="w-full px-3 py-2 bg-vale-surface border border-vale-border rounded-lg text-sm text-vale-text"
              >
                <option value="person">Person</option>
                <option value="concept">Concept</option>
                <option value="event">Event</option>
                <option value="place">Place</option>
                <option value="thing">Thing</option>
                <option value="moment">Moment</option>
                <option value="pattern">Pattern</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isCreatingEntity}
                  className="flex-1 px-3 py-2 bg-vale-accent hover:bg-vale-accent/80 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-3 py-2 bg-vale-surface border border-vale-border rounded-lg text-vale-muted text-sm hover:text-vale-text"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Identity Section */}
        <div className="px-4 sm:px-6 pb-3">
          <button
            onClick={() => setIdentityExpanded(!identityExpanded)}
            className="w-full flex items-center justify-between py-2 text-left"
          >
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-vale-mint" />
              <span className="text-sm font-semibold text-vale-text">Identity</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-vale-muted hidden sm:inline">Who your AI is before they remember anything</span>
              {identityExpanded ? (
                <ChevronDown className="w-3 h-3 text-vale-muted" />
              ) : (
                <ChevronRight className="w-3 h-3 text-vale-muted" />
              )}
            </div>
          </button>

          {identityExpanded && (
            <div className="space-y-2 mt-1">
              {Object.entries(identitiesByPerspective).length > 0 ? (
                Object.entries(identitiesByPerspective).map(([perspective, ids]) => (
                  <div key={perspective} className="bg-vale-card border border-vale-border rounded-lg p-3">
                    <p className="text-sm font-semibold text-vale-lincoln mb-2">{perspective}</p>
                    <div className="space-y-1">
                      {ids.map((id, idx) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span className="text-vale-muted">{id.category ? `${id.category}.` : ''}{id.key}</span>
                          <span className="text-vale-text truncate ml-2 max-w-[60%] text-right">{id.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-vale-muted py-2">No identity values set yet</p>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-4 sm:mx-6 border-t border-vale-border" />

        {/* Entity List */}
        <div className="flex-1 px-4 sm:px-6 py-3 space-y-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-vale-card rounded-lg animate-pulse" />
              ))}
            </div>
          ) : viewMode === 'salience' ? (
            /* Salience-grouped view */
            <div className="space-y-1">
              {SALIENCE_LEVELS.map((level) => {
                const count = salienceCounts[level.key] || 0;
                const isExpanded = expandedSalience.includes(level.key);
                const levelEntities = entitiesBySalience[level.key] || [];

                return (
                  <div key={level.key}>
                    <button
                      onClick={() => toggleSalience(level.key)}
                      className="w-full flex items-center justify-between py-2 px-2 hover:bg-vale-card/50 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3 text-vale-muted" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-vale-muted" />
                        )}
                        <span className={`text-sm font-medium ${level.color}`}>{level.label}</span>
                      </div>
                      <span className="text-xs text-vale-muted bg-vale-card px-2 py-0.5 rounded-full">{count}</span>
                    </button>

                    {isExpanded && levelEntities.length > 0 && (
                      <div className="ml-5 space-y-0.5 mb-2">
                        {levelEntities.map((entity) => (
                          <button
                            key={entity.name}
                            onClick={() => selectEntity(entity)}
                            className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${
                              selectedEntity?.name === entity.name
                                ? 'bg-vale-accent/20 text-vale-accent border border-vale-accent/30'
                                : 'text-vale-text hover:bg-vale-card'
                            }`}
                          >
                            <span className="font-medium">{entity.name}</span>
                            <span className="text-[10px] text-vale-muted ml-2">{entity.entity_type || entity.type}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {isExpanded && levelEntities.length === 0 && count > 0 && (
                      <p className="ml-7 text-xs text-vale-muted py-1">
                        {count} entities (filtered out by search)
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Flat list view */
            filteredEntities.length > 0 ? (
              filteredEntities.map((entity) => (
                <button
                  key={entity.name}
                  onClick={() => selectEntity(entity)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedEntity?.name === entity.name
                      ? 'bg-vale-accent/20 text-vale-accent border border-vale-accent/30'
                      : 'bg-vale-card hover:bg-vale-border text-vale-text'
                  }`}
                >
                  <p className="font-medium text-sm">{entity.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] opacity-75">{entity.entity_type || entity.type}</span>
                    {entity.salience && (
                      <span className="text-[10px] text-vale-muted">{entity.salience}</span>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <p className="text-center text-vale-muted py-8 text-sm">No entities found</p>
            )
          )}
        </div>
      </div>

      {/* Right Panel - Entity Detail */}
      <div className={`${showDetail ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-y-auto`}>
        {selectedEntity ? (
          <div className="p-4 sm:p-8 space-y-6">
            {/* Back button (mobile) */}
            <button
              onClick={() => setShowDetail(false)}
              className="md:hidden flex items-center gap-1 text-vale-muted text-sm hover:text-vale-text mb-2"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Back to list
            </button>

            {/* Entity Header */}
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

            {/* Metadata */}
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
              <div className="bg-vale-card rounded-lg px-3 py-2 border border-vale-border">
                <p className="text-[10px] text-vale-muted uppercase">Observations</p>
                <p className="text-sm font-medium text-vale-cyan">{selectedEntity.observations?.length || 0}</p>
              </div>
            </div>

            {/* Observations */}
            <div>
              <h3 className="text-lg font-semibold text-vale-text mb-3">Observations</h3>

              {selectedEntity.observations && selectedEntity.observations.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {selectedEntity.observations.map((obs, idx) => (
                    <div
                      key={idx}
                      className="bg-vale-card rounded-lg p-3 border border-vale-border"
                    >
                      <p className="text-vale-text text-sm">{obs}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-vale-muted text-sm mb-4">No observations yet</p>
              )}

              {/* Add Observation Form */}
              <form onSubmit={handleAddObservation} className="space-y-2">
                <textarea
                  placeholder="Add a new observation..."
                  value={newObservation}
                  onChange={(e) => setNewObservation(e.target.value)}
                  className="w-full px-3 py-2 bg-vale-card border border-vale-border rounded-lg text-vale-text placeholder-vale-muted text-sm min-h-[80px] resize-none"
                />
                <button
                  type="submit"
                  disabled={isAddingObservation || !newObservation.trim()}
                  className="px-4 py-2 bg-vale-accent hover:bg-vale-accent/80 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                >
                  Add Observation
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-center p-8">
            <div>
              <Brain className="w-12 h-12 text-vale-muted/30 mx-auto mb-3" />
              <p className="text-vale-muted">Select an entity to view details</p>
              <p className="text-vale-muted/60 text-sm mt-1">or create a new one with the + button</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
