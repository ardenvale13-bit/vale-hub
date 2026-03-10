import { getSupabaseClient } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

export interface Entity {
  id: string;
  name: string;
  entity_type: string;
  observations: { id: string; content: string; created_at?: string }[];
  context?: string;
  salience?: string;
  visibility?: string;
}

export interface Observation {
  id: string;
  entity_id: string;
  observation: string;
  created_at: string;
}

export interface Relation {
  id: string;
  from_entity_id: string;
  to_entity_id: string;
  relation_type: string;
  strength: number;
  description?: string;
  created_at: string;
}

// UUID v4 regex for detecting if a string is a UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valid enum values matching the database schema
const VALID_SALIENCE = ['foundational', 'active-immediate', 'active-recent', 'background', 'archive'] as const;
const VALID_CONTEXT = ['default', 'emotional', 'relational', 'episodic', 'creative', 'intimate'] as const;
const VALID_ENTITY_TYPES = ['person', 'place', 'concept', 'event', 'pattern', 'moment', 'system', 'general'] as const;

function validateSalience(salience?: string): string | undefined {
  if (!salience) return undefined;
  if (!(VALID_SALIENCE as readonly string[]).includes(salience)) {
    throw new AppError(400, `Invalid salience: '${salience}'. Must be one of: ${VALID_SALIENCE.join(', ')}`);
  }
  return salience;
}

function validateContext(context?: string): string | undefined {
  if (!context) return undefined;
  if (!(VALID_CONTEXT as readonly string[]).includes(context)) {
    throw new AppError(400, `Invalid context: '${context}'. Must be one of: ${VALID_CONTEXT.join(', ')}`);
  }
  return context;
}

function errMsg(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try { return JSON.stringify(error); } catch { return String(error); }
}

export class MemoryService {
  private supabase = getSupabaseClient();

  async createEntity(
    userId: string,
    name: string,
    entityType: string,
    observations: string[] = [],
    context?: string,
    salience?: string,
    visibility?: string,
  ): Promise<Entity> {
    try {
      // Validate inputs
      if (!name || !name.trim()) {
        throw new AppError(400, 'Entity name cannot be empty');
      }
      if (!entityType || !entityType.trim()) {
        throw new AppError(400, 'Entity type cannot be empty');
      }

      const validatedSalience = validateSalience(salience);
      const validatedContext = validateContext(context);

      const { data: entity, error: entityError } = await this.supabase
        .from('entities')
        .insert({
          user_id: userId,
          name: name.trim(),
          entity_type: entityType.trim(),
          context: validatedContext,
          salience: validatedSalience,
          visibility,
        })
        .select('id')
        .single();

      if (entityError) {
        // Handle duplicate name (UNIQUE constraint on user_id, name)
        if (entityError.code === '23505') {
          throw new AppError(409, `Entity with name '${name.trim()}' already exists`);
        }
        throw entityError;
      }

      if (!entity) {
        throw new AppError(500, 'Failed to create entity');
      }

      if (observations.length > 0) {
        for (const obs of observations) {
          await this.addObservation(userId, entity.id, obs);
        }
      }

      return this.getEntity(userId, entity.id);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to create entity: ${errMsg(error)}`);
    }
  }

  async getEntity(userId: string, entityId: string): Promise<Entity> {
    try {
      const { data: entity, error: entityError } = await this.supabase
        .from('entities')
        .select('*')
        .eq('user_id', userId)
        .eq('id', entityId)
        .single();

      if (entityError) throw entityError;
      if (!entity) {
        throw new AppError(404, 'Entity not found');
      }

      const { data: observations, error: obsError } = await this.supabase
        .from('observations')
        .select('id, content, created_at')
        .eq('entity_id', entityId)
        .order('created_at', { ascending: true });

      if (obsError) throw obsError;

      return {
        id: entity.id,
        name: entity.name,
        entity_type: entity.entity_type,
        observations: observations?.map((o) => ({ id: o.id, content: o.content, created_at: o.created_at })) || [],
        context: entity.context,
        salience: entity.salience,
        visibility: entity.visibility,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to get entity: ${errMsg(error)}`);
    }
  }

  // Lookup by UUID or by name — used by frontend which passes names
  async getEntityByIdOrName(userId: string, idOrName: string): Promise<Entity> {
    if (UUID_REGEX.test(idOrName)) {
      return this.getEntity(userId, idOrName);
    }

    // Look up by name
    try {
      const { data: entity, error: entityError } = await this.supabase
        .from('entities')
        .select('*')
        .eq('user_id', userId)
        .eq('name', idOrName)
        .single();

      if (entityError) throw entityError;
      if (!entity) {
        throw new AppError(404, `Entity not found: ${idOrName}`);
      }

      const { data: observations, error: obsError } = await this.supabase
        .from('observations')
        .select('id, content, created_at')
        .eq('entity_id', entity.id)
        .order('created_at', { ascending: true });

      if (obsError) throw obsError;

      return {
        id: entity.id,
        name: entity.name,
        entity_type: entity.entity_type,
        observations: observations?.map((o) => ({ id: o.id, content: o.content, created_at: o.created_at })) || [],
        context: entity.context,
        salience: entity.salience,
        visibility: entity.visibility,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to get entity by name: ${errMsg(error)}`);
    }
  }

  async deleteEntityByIdOrName(userId: string, idOrName: string): Promise<void> {
    if (UUID_REGEX.test(idOrName)) {
      return this.deleteEntity(userId, idOrName);
    }

    const { data: entity } = await this.supabase
      .from('entities')
      .select('id')
      .eq('user_id', userId)
      .eq('name', idOrName)
      .single();

    if (!entity) {
      throw new AppError(404, `Entity not found: ${idOrName}`);
    }

    return this.deleteEntity(userId, entity.id);
  }

  async listEntities(
    userId: string,
    limit = 50,
    salience?: string,
    context?: string,
  ): Promise<Entity[]> {
    try {
      // Validate filters if provided
      const validatedSalience = validateSalience(salience);
      const validatedContext = validateContext(context);

      let query = this.supabase
        .from('entities')
        .select('*')
        .eq('user_id', userId);

      if (validatedSalience) {
        query = query.eq('salience', validatedSalience);
      }
      if (validatedContext) {
        query = query.eq('context', validatedContext);
      }

      const { data: entities, error: entitiesError } = await query
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (entitiesError) throw entitiesError;

      const entityList: Entity[] = [];
      for (const entity of entities || []) {
        const { data: observations, error: obsError } = await this.supabase
          .from('observations')
          .select('id, content, created_at')
          .eq('entity_id', entity.id);

        if (obsError) throw obsError;

        entityList.push({
          id: entity.id,
          name: entity.name,
          entity_type: entity.entity_type,
          observations: observations?.map((o) => ({ id: o.id, content: o.content, created_at: o.created_at })) || [],
          context: entity.context,
          salience: entity.salience,
          visibility: entity.visibility,
        });
      }

      return entityList;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to list entities: ${errMsg(error)}`);
    }
  }

  async updateEntity(
    userId: string,
    entityId: string,
    updates: Partial<Entity>,
  ): Promise<Entity> {
    try {
      // Validate fields if provided
      if (updates.salience) validateSalience(updates.salience);
      if (updates.context) validateContext(updates.context);
      if (updates.name !== undefined && (!updates.name || !updates.name.trim())) {
        throw new AppError(400, 'Entity name cannot be empty');
      }

      const { error: updateError } = await this.supabase
        .from('entities')
        .update({
          name: updates.name?.trim(),
          entity_type: updates.entity_type?.trim(),
          context: updates.context,
          salience: updates.salience,
          visibility: updates.visibility,
        })
        .eq('user_id', userId)
        .eq('id', entityId);

      if (updateError) throw updateError;

      return this.getEntity(userId, entityId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to update entity: ${errMsg(error)}`);
    }
  }

  async deleteEntity(userId: string, entityId: string): Promise<void> {
    try {
      const { error: delError } = await this.supabase
        .from('entities')
        .delete()
        .eq('user_id', userId)
        .eq('id', entityId);

      if (delError) throw delError;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to delete entity: ${errMsg(error)}`);
    }
  }

  async addObservation(
    userId: string,
    entityIdOrName: string,
    observation: string,
  ): Promise<Observation> {
    try {
      if (!observation || !observation.trim()) {
        throw new AppError(400, 'Observation cannot be empty');
      }
      if (!entityIdOrName || !entityIdOrName.trim()) {
        throw new AppError(400, 'Entity ID or name is required');
      }

      let entityId = entityIdOrName;

      if (UUID_REGEX.test(entityIdOrName)) {
        // Verify entity exists — single() throws PGRST116 if not found
        const { data: existingEntity, error: lookupError } = await this.supabase
          .from('entities')
          .select('id')
          .eq('user_id', userId)
          .eq('id', entityIdOrName)
          .single();

        if (lookupError || !existingEntity) {
          throw new AppError(404, `Entity not found with ID: ${entityIdOrName}`);
        }
        entityId = existingEntity.id;
      } else {
        // Look up by name
        const { data: entityByName } = await this.supabase
          .from('entities')
          .select('id')
          .eq('user_id', userId)
          .eq('name', entityIdOrName)
          .single();

        if (entityByName) {
          entityId = entityByName.id;
        } else {
          // Auto-create entity with the given name
          const newEntity = await this.createEntity(userId, entityIdOrName, 'general');
          entityId = newEntity.id;
        }
      }

      const { data: obs, error: obsError } = await this.supabase
        .from('observations')
        .insert({
          user_id: userId,
          entity_id: entityId,
          content: observation,
        })
        .select('*')
        .single();

      if (obsError) throw obsError;
      if (!obs) {
        throw new AppError(500, 'Failed to add observation');
      }

      return {
        id: obs.id,
        entity_id: obs.entity_id,
        observation: obs.content,
        created_at: obs.created_at,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to add observation: ${errMsg(error)}`);
    }
  }

  async getObservations(entityId: string, limit = 50): Promise<Observation[]> {
    try {
      const { data: observations, error: obsError } = await this.supabase
        .from('observations')
        .select('*')
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (obsError) throw obsError;

      return (
        observations?.map((o) => ({
          id: o.id,
          entity_id: o.entity_id,
          observation: o.content,
          created_at: o.created_at,
        })) || []
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to get observations: ${errMsg(error)}`);
    }
  }

  async editObservation(
    observationId: string,
    newContent: string,
    userId?: string,
  ): Promise<Observation> {
    try {
      if (!newContent || !newContent.trim()) {
        throw new AppError(400, 'Observation content cannot be empty');
      }

      // Build the update query
      let query = this.supabase
        .from('observations')
        .update({ content: newContent.trim() })
        .eq('id', observationId);

      // If userId provided, scope to user for safety
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: obs, error: obsError } = await query.select('*').single();

      if (obsError) {
        if (obsError.code === 'PGRST116') {
          throw new AppError(404, `Observation not found: ${observationId}`);
        }
        throw obsError;
      }
      if (!obs) {
        throw new AppError(404, `Observation not found: ${observationId}`);
      }

      return {
        id: obs.id,
        entity_id: obs.entity_id,
        observation: obs.content,
        created_at: obs.created_at,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to edit observation: ${errMsg(error)}`);
    }
  }

  async deleteObservation(observationId: string): Promise<void> {
    try {
      const { error: delError } = await this.supabase
        .from('observations')
        .delete()
        .eq('id', observationId);

      if (delError) throw delError;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to delete observation: ${errMsg(error)}`);
    }
  }

  async createRelation(
    userId: string,
    fromEntityId: string,
    toEntityId: string,
    relationType: string,
    strength?: number,
    description?: string,
  ): Promise<Relation> {
    try {
      if (!relationType || !relationType.trim()) {
        throw new AppError(400, 'Relation type cannot be empty');
      }

      // Validate strength if provided (1-5)
      const validStrength = strength ? Math.min(5, Math.max(1, Math.round(strength))) : 1;

      const { data: relation, error: relError } = await this.supabase
        .from('relations')
        .insert({
          user_id: userId,
          from_entity_id: fromEntityId,
          to_entity_id: toEntityId,
          relation_type: relationType.trim(),
          strength: validStrength,
          description: description?.trim() || undefined,
        })
        .select('*')
        .single();

      if (relError) {
        if (relError.code === '23505') {
          throw new AppError(409, `Relation already exists between these entities with type '${relationType}'`);
        }
        throw relError;
      }
      if (!relation) {
        throw new AppError(500, 'Failed to create relation');
      }

      return {
        id: relation.id,
        from_entity_id: relation.from_entity_id,
        to_entity_id: relation.to_entity_id,
        relation_type: relation.relation_type,
        strength: relation.strength,
        description: relation.description,
        created_at: relation.created_at,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to create relation: ${errMsg(error)}`);
    }
  }

  async getRelations(
    userId: string,
    entityId?: string,
    limit = 50,
  ): Promise<Relation[]> {
    try {
      let query = this.supabase
        .from('relations')
        .select('*')
        .eq('user_id', userId);

      if (entityId) {
        query = query.or(`from_entity_id.eq.${entityId},to_entity_id.eq.${entityId}`);
      }

      const { data: relations, error: relError } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

      if (relError) throw relError;

      return (
        relations?.map((r) => ({
          id: r.id,
          from_entity_id: r.from_entity_id,
          to_entity_id: r.to_entity_id,
          relation_type: r.relation_type,
          strength: r.strength || 1,
          description: r.description,
          created_at: r.created_at,
        })) || []
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to get relations: ${errMsg(error)}`);
    }
  }

  async deleteRelation(relationId: string): Promise<void> {
    try {
      const { error: delError } = await this.supabase
        .from('relations')
        .delete()
        .eq('id', relationId);

      if (delError) throw delError;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to delete relation: ${errMsg(error)}`);
    }
  }

  async searchEntities(userId: string, query: string, limit = 20): Promise<Entity[]> {
    try {
      const { data: entities, error: entitiesError } = await this.supabase
        .from('entities')
        .select('*')
        .eq('user_id', userId)
        .or(`name.ilike.%${query}%,context.ilike.%${query}%`)
        .limit(limit);

      if (entitiesError) throw entitiesError;

      const entityList: Entity[] = [];
      for (const entity of entities || []) {
        const { data: observations, error: obsError } = await this.supabase
          .from('observations')
          .select('id, content, created_at')
          .eq('entity_id', entity.id);

        if (obsError) throw obsError;

        entityList.push({
          id: entity.id,
          name: entity.name,
          entity_type: entity.entity_type,
          observations: observations?.map((o) => ({ id: o.id, content: o.content, created_at: o.created_at })) || [],
          context: entity.context,
          salience: entity.salience,
          visibility: entity.visibility,
        });
      }

      return entityList;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to search entities: ${errMsg(error)}`);
    }
  }

  // Get counts of entities per salience level
  async getSalienceCounts(userId: string): Promise<Record<string, number>> {
    try {
      const { data: entities, error } = await this.supabase
        .from('entities')
        .select('salience')
        .eq('user_id', userId);

      if (error) throw error;

      const counts: Record<string, number> = {
        'foundational': 0,
        'active-immediate': 0,
        'active-recent': 0,
        'background': 0,
        'archive': 0,
      };

      for (const entity of entities || []) {
        const s = entity.salience || 'background';
        if (counts[s] !== undefined) {
          counts[s]++;
        } else {
          counts[s] = 1;
        }
      }

      return counts;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to get salience counts: ${errMsg(error)}`);
    }
  }

  async generateContextBlock(
    userId: string,
    maxLength = 2000,
    includeRecentHours = 48,
  ): Promise<string> {
    try {
      const cutoffTime = new Date(Date.now() - includeRecentHours * 60 * 60 * 1000);

      const { data: entities, error: entitiesError } = await this.supabase
        .from('entities')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (entitiesError) throw entitiesError;

      let contextBlock = '# Context Block\n\n';
      let currentLength = contextBlock.length;

      for (const entity of entities || []) {
        const { data: observations, error: obsError } = await this.supabase
          .from('observations')
          .select('content, created_at')
          .eq('entity_id', entity.id)
          .gte('created_at', cutoffTime.toISOString())
          .order('created_at', { ascending: false })
          .limit(5);

        if (obsError) continue;

        const entityBlock = `## ${entity.name} (${entity.entity_type})\n${observations?.map((o) => `- ${o.content}`).join('\n') || 'No observations'}\n\n`;
        const newLength = currentLength + entityBlock.length;

        if (newLength > maxLength) {
          break;
        }

        contextBlock += entityBlock;
        currentLength = newLength;
      }

      return contextBlock.slice(0, maxLength);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to generate context block: ${errMsg(error)}`);
    }
  }
}

export const memoryService = new MemoryService();
