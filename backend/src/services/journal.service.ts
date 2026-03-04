import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

// ============ JOURNAL ENTRIES ============

export interface CreateJournalInput {
  title?: string;
  content: string;
  entry_type?: string;
  category?: string;
  perspective?: string;
  tags?: string[];
}

export async function createJournalEntry(userId: string, input: CreateJournalInput) {
  const { data, error } = await supabase
    .from('journal_entries')
    .insert({
      user_id: userId,
      title: input.title,
      content: input.content,
      entry_type: input.entry_type || 'journal',
      category: input.category,
      author_perspective: input.perspective || 'default',
      tags: input.tags || [],
    })
    .select()
    .single();

  if (error) throw new AppError(`Failed to create journal entry: ${error.message}`, 500);
  return data;
}

export async function listJournalEntries(
  userId: string,
  options: {
    category?: string;
    entry_type?: string;
    perspective?: string;
    days?: number;
    limit?: number;
    offset?: number;
  } = {}
) {
  let query = supabase
    .from('journal_entries')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (options.category) query = query.eq('category', options.category);
  if (options.entry_type) query = query.eq('entry_type', options.entry_type);
  if (options.perspective) query = query.eq('author_perspective', options.perspective);
  if (options.days) {
    const cutoff = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('created_at', cutoff);
  }
  if (options.limit) query = query.limit(options.limit);
  if (options.offset) query = query.range(options.offset, options.offset + (options.limit || 50) - 1);

  const { data, error, count } = await query;
  if (error) throw new AppError(`Failed to list journal entries: ${error.message}`, 500);
  return { data: data || [], total: count || 0 };
}

export async function getJournalEntry(userId: string, entryId: string) {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('id', entryId)
    .eq('user_id', userId)
    .single();

  if (error || !data) throw new AppError('Journal entry not found', 404);
  return data;
}

export async function updateJournalEntry(
  userId: string,
  entryId: string,
  input: Partial<CreateJournalInput>
) {
  // Map perspective to the actual column name
  const updateData: any = { ...input };
  if (input.perspective !== undefined) {
    updateData.author_perspective = input.perspective;
    delete updateData.perspective;
  }

  const { data, error } = await supabase
    .from('journal_entries')
    .update(updateData)
    .eq('id', entryId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new AppError(`Failed to update journal entry: ${error.message}`, 500);
  return data;
}

export async function deleteJournalEntry(userId: string, entryId: string) {
  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId);

  if (error) throw new AppError(`Failed to delete journal entry: ${error.message}`, 500);
  return { success: true };
}

// ============ STATUS ============

export async function setStatus(userId: string, category: string, key: string, value: string) {
  const { data, error } = await supabase
    .from('statuses')
    .upsert(
      { user_id: userId, category, key, value },
      { onConflict: 'user_id,category,key' }
    )
    .select()
    .single();

  if (error) throw new AppError(`Failed to set status: ${error.message}`, 500);
  return data;
}

export async function getStatus(userId: string, category?: string) {
  let query = supabase
    .from('statuses')
    .select('*')
    .eq('user_id', userId);

  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) throw new AppError(`Failed to get status: ${error.message}`, 500);
  return data || [];
}

export async function deleteStatus(userId: string, category: string, key: string) {
  const { error } = await supabase
    .from('statuses')
    .delete()
    .eq('user_id', userId)
    .eq('category', category)
    .eq('key', key);

  if (error) throw new AppError(`Failed to delete status: ${error.message}`, 500);
  return { success: true };
}

// ============ IDENTITY ============

export async function setIdentity(
  userId: string,
  perspective: string,
  category: string,
  key: string,
  value: string
) {
  const { data, error } = await supabase
    .from('identity_store')
    .upsert(
      { user_id: userId, owner_perspective: perspective, category, key, value },
      { onConflict: 'user_id,owner_perspective,category,key' }
    )
    .select()
    .single();

  if (error) throw new AppError(`Failed to set identity: ${error.message}`, 500);
  return data;
}

export async function getIdentity(userId: string, perspective?: string) {
  let query = supabase
    .from('identity_store')
    .select('*')
    .eq('user_id', userId);

  if (perspective) query = query.eq('owner_perspective', perspective);

  const { data, error } = await query;
  if (error) throw new AppError(`Failed to get identity: ${error.message}`, 500);
  return data || [];
}

export async function deleteIdentity(userId: string, perspective: string, category: string, key: string) {
  const { error } = await supabase
    .from('identity_store')
    .delete()
    .eq('user_id', userId)
    .eq('owner_perspective', perspective)
    .eq('category', category)
    .eq('key', key);

  if (error) throw new AppError(`Failed to delete identity: ${error.message}`, 500);
  return { success: true };
}
