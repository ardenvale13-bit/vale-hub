import { getSupabaseClient } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

export interface Entity {
  id: string;
  name: string;
  entity_type: string;
  observations: string[];
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
  metadata?: Record<string, any>;
  created_at: string;
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
      const { data: entity, error: entityError } = await this.supabase
        .from('entities')
        .insert({
          user_id: userId,
          name,
          entity_type: entityType,
          context,
          salience,
          visibility,
        })
        .select('id')
        .single();

      if (entityError) throw entityError;

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
      throw new AppError(500, `Failed to create entity: ${error}`);
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
        .select('observation')
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (obsError) throw obsError;

      return {
        id: entity.id,
        name: entity.name,
        entity_type: entity.entity_type,
        observations: observations?.map((o) => o.observation) || [],
        context: entity.context,
        salience: entity.salience,
        visibility: entity.visibility,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to get entity: ${error}`);
    }
  }

  async listEntities(userId: string, limit = 50): Promise<Entity[]> {
    try {
      const { data: entities, error: entitiesError } = await this.supabase
        .from('entities')
        .select('*')
        .eq('user_id', userId)
        .limit(limit);

      if (entitiesError) throw entitiesError;

      const entityList: Entity[] = [];
      for (const entity of entities || []) {
        const { data: observations, error: obsError } = await this.supabase
          .from('observations')
          .select('observation')
          .eq('entity_id', entity.id);

        if (obsError) throw obsError;

        entityList.push({
          id: entity.id,
          name: entity.name,
          entity_type: entity.entity_type,
          observations: observations?.map((o) => o.observation) || [],
          context: entity.context,
          salience: entity.salience,
          visibility: entity.visibility,
        });
      }

      return entityList;
    } catch (error) {
      throw new AppError(500, `Failed to list entities: ${error}`);
    }
  }

  async updateEntity(
    userId: string,
    entityId: string,
    updates: Partial<Entity>,
  ): Promise<Entity> {
    try {
      const { error: updateError } = await this.supabase
        .from('entities')
        .update({
          name: updates.name,
          entity_type: updates.entity_type,
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
      throw new AppError(500, `Failed to update entity: ${error}`);
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
      throw new AppError(500, `Failed to delete entity: ${error}`);
    }
  }

  async addObservation(
    userId: string,
    entityIdOrName: string,
    observation: string,
  ): Promise<Observation> {
    try {
      let entityId = entityIdOrName;

      const { data: existingEntity } = await this.supabase
        .from('entities')
        .select('id')
        .eq('user_id', userId)
        .eq('id', entityIdOrName)
        .single();

      if (!existingEntity) {
        const { data: entityByName } = await this.supabase
          .from('entities')
          .select('id')
          .eq('user_id', userId)
          .eq('name', entityIdOrName)
          .single();

        if (entityByName) {
          entityId = entityByName.id;
        } else {
          const newEntity = await this.createEntity(userId, entityIdOrName, 'general');
          entityId = newEntity.id;
        }
      }

      const { data: obs, error: obsError } = await this.supabase
        .from('observations')
        .insert({
          entity_id: entityId,
          observation,
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
        observation: obs.observation,
        created_at: obs.created_at,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to add observation: ${error}`);
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
          observation: o.observation,
          created_at: o.created_at,
        })) || []
      );
    } catch (error) {
      throw new AppError(500, `Failed to get observations: ${error}`);
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
      throw new AppError(500, `Failed to delete observation: ${error}`);
    }
  }

  async createRelation(
    userId: string,
    fromEntityId: string,
    toEntityId: string,
    relationType: string,
    metadata?: Record<string, any>,
  ): Promise<Relation> {
    try {
      const { data: relation, error: relError } = await this.supabase
        .from('relations')
        .insert({
          user_id: userId,
          from_entity_id: fromEntityId,
          to_entity_id: toEntityId,
          relation_type: relationType,
          metadata,
        })
        .select('*')
        .single();

      if (relError) throw relError;
      if (!relation) {
        throw new AppError(500, 'Failed to create relation');
      }

      return {
        id: relation.id,
        from_entity_id: relation.from_entity_id,
        to_entity_id: relation.to_entity_id,
        relation_type: relation.relation_type,
        metadata: relation.metadata,
        created_at: relation.created_at,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to create relation: ${error}`);
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
          metadata: r.metadata,
          created_at: r.created_at,
        })) || []
      );
    } catch (error) {
      throw new AppError(500, `Failed to get relations: ${error}`);
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
      throw new AppError(500, `Failed to delete relation: ${error}`);
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
          .select('observation')
          .eq('entity_id', entity.id);

        if (obsError) throw obsError;

        entityList.push({
          id: entity.id,
          name: entity.name,
          entity_type: entity.entity_type,
          observations: observations?.map((o) => o.observation) || [],
          context: entity.context,
          salience: entity.salience,
          visibility: entity.visibility,
        });
      }

      return entityList;
    } catch (error) {
      throw new AppError(500, `Failed to search entities: ${error}`);
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
          .select('observation, created_at')
          .eq('entity_id', entity.id)
          .gte('created_at', cutoffTime.toISOString())
          .order('created_at', { ascending: false })
          .limit(5);

        if (obsError) continue;

        const entityBlock = `## ${entity.name} (${entity.entity_type})\n${observations?.map((o) => `- ${o.observation}`).join('\n') || 'No observations'}\n\n`;
        const newLength = currentLength + entityBlock.length;

        if (newLength > maxLength) {
          break;
        }

        contextBlock += entityBlock;
        currentLength = newLength;
      }

      return contextBlock.slice(0, maxLength);
    } catch (error) {
      throw new AppError(500, `Failed to generate context block: ${error}`);
    }
  }
}

export const memoryService = new MemoryService();
