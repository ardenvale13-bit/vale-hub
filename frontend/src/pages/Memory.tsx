import { useState, useEffect } from 'react';
import { api, Entity } from '../services/api';
import { Plus, Search, Trash2 } from 'lucide-react';

type SalienceFilter = '' | 'foundational' | 'active-immediate' | 'active-recent' | 'background' | 'archive';
type ContextFilter = '' | 'default' | 'emotional' | 'relational' | 'episodic' | 'creative' | 'intimate';

export default function Memory() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [salienceFilter, setSalienceFilter] = useState<SalienceFilter>('');
  const [contextFilter, setContextFilter] = useState<ContextFilter>('');
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [newEntityName, setNewEntityName] = useState('');
  const [newEntityType, setNewEntityType] = useState('person');
  const [newObservation, setNewObservation] = useState('');
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);
  const [isAddingObservation, setIsAddingObservation] = useState(false);

  // Load entities
  useEffect(() => {
    loadEntities();
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

  const filteredEntities = entities.filter((entity) =>
    entity.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      setEntities([...entities, created]);
      setSelectedEntity(created);
      setNewEntityName('');
      setNewEntityType('person');
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
      }
    } catch (error) {
      console.error('Error deleting entity:', error);
    }
  }

  return (
    <div className="flex h-full">
      {/* Left Panel - Entity List */}
      <div className="w-80 bg-hearth-surface border-r border-hearth-border flex flex-col overflow-y-auto">
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold text-hearth-text">Memory</h1>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-hearth-muted" />
            <input
              type="text"
              placeholder="Search entities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-hearth-card border border-hearth-border rounded text-hearth-text placeholder-hearth-muted"
            />
          </div>

          {/* Filters */}
          <div className="space-y-3">
            <select
              value={salienceFilter}
              onChange={(e) => setSalienceFilter(e.target.value as SalienceFilter)}
              className="w-full px-3 py-2 bg-hearth-card border border-hearth-border rounded text-hearth-text"
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
              className="w-full px-3 py-2 bg-hearth-card border border-hearth-border rounded text-hearth-text"
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

          {/* Create Entity Form */}
          <form onSubmit={handleCreateEntity} className="pt-4 border-t border-hearth-border space-y-3">
            <h3 className="font-semibold text-hearth-text text-sm">New Entity</h3>
            <input
              type="text"
              placeholder="Entity name"
              value={newEntityName}
              onChange={(e) => setNewEntityName(e.target.value)}
              className="w-full px-3 py-2 bg-hearth-card border border-hearth-border rounded text-sm"
            />
            <select
              value={newEntityType}
              onChange={(e) => setNewEntityType(e.target.value)}
              className="w-full px-3 py-2 bg-hearth-card border border-hearth-border rounded text-sm"
            >
              <option value="person">Person</option>
              <option value="concept">Concept</option>
              <option value="event">Event</option>
              <option value="place">Place</option>
              <option value="thing">Thing</option>
            </select>
            <button
              type="submit"
              disabled={isCreatingEntity}
              className="w-full px-3 py-2 bg-hearth-accent hover:bg-opacity-90 text-white rounded font-medium text-sm transition-colors disabled:opacity-50"
            >
              <Plus className="inline w-4 h-4 mr-1" />
              Create Entity
            </button>
          </form>
        </div>

        {/* Entity List */}
        <div className="flex-1 px-6 pb-6 space-y-2 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-hearth-card rounded animate-pulse" />
              ))}
            </div>
          ) : filteredEntities.length > 0 ? (
            filteredEntities.map((entity) => (
              <button
                key={entity.name}
                onClick={() => setSelectedEntity(entity)}
                className={`w-full text-left p-3 rounded transition-colors ${
                  selectedEntity?.name === entity.name
                    ? 'bg-hearth-accent text-white'
                    : 'bg-hearth-card hover:bg-hearth-border text-hearth-text'
                }`}
              >
                <p className="font-medium">{entity.name}</p>
                <p className="text-xs opacity-75">{entity.type}</p>
              </button>
            ))
          ) : (
            <p className="text-center text-hearth-muted py-8">No entities found</p>
          )}
        </div>
      </div>

      {/* Right Panel - Entity Detail */}
      <div className="flex-1 p-8 overflow-y-auto">
        {selectedEntity ? (
          <div className="space-y-6">
            {/* Entity Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-3xl font-bold text-hearth-text">{selectedEntity.name}</h2>
                <p className="text-hearth-muted">{selectedEntity.type}</p>
              </div>
              <button
                onClick={() => handleDeleteEntity(selectedEntity.name)}
                className="p-2 hover:bg-hearth-surface rounded transition-colors text-hearth-ember"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4">
              {selectedEntity.salience && (
                <div className="bg-hearth-card rounded p-3 border border-hearth-border">
                  <p className="text-sm text-hearth-muted mb-1">Salience</p>
                  <p className="font-medium text-hearth-text">{selectedEntity.salience}</p>
                </div>
              )}
              {selectedEntity.context && (
                <div className="bg-hearth-card rounded p-3 border border-hearth-border">
                  <p className="text-sm text-hearth-muted mb-1">Context</p>
                  <p className="font-medium text-hearth-text">{selectedEntity.context}</p>
                </div>
              )}
            </div>

            {/* Observations */}
            <div>
              <h3 className="text-xl font-semibold text-hearth-text mb-4">Observations</h3>

              {selectedEntity.observations && selectedEntity.observations.length > 0 ? (
                <div className="space-y-3 mb-6">
                  {selectedEntity.observations.map((obs, idx) => (
                    <div
                      key={idx}
                      className="bg-hearth-card rounded p-4 border border-hearth-border"
                    >
                      <p className="text-hearth-text">{obs}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-hearth-muted mb-6">No observations yet</p>
              )}

              {/* Add Observation Form */}
              <form onSubmit={handleAddObservation} className="space-y-3">
                <textarea
                  placeholder="Add a new observation..."
                  value={newObservation}
                  onChange={(e) => setNewObservation(e.target.value)}
                  className="w-full px-4 py-3 bg-hearth-card border border-hearth-border rounded text-hearth-text placeholder-hearth-muted min-h-20"
                />
                <button
                  type="submit"
                  disabled={isAddingObservation}
                  className="px-6 py-2 bg-hearth-accent hover:bg-opacity-90 text-white rounded font-medium transition-colors disabled:opacity-50"
                >
                  Add Observation
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-hearth-muted text-lg">Select an entity to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
