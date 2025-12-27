import type { 
  IStorage, 
  Job, 
  InsertJob, 
  TransactionRecord, 
  InsertTransactionRecord,
  MatchRecord,
  InsertMatchRecord,
  Cluster,
  InsertCluster,
  AuditLog,
  InsertAuditLog 
} from '@/@types'
import { createClient } from '../supabase/server'

export class SupabaseStorage implements IStorage {
  // Jobs
  async createJob(job: InsertJob): Promise<Job> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('jobs')
      .insert(job)
      .select()
      .single()
    
    if (error) throw error
    return data as Job
  }

  async getJob(id: string): Promise<Job | undefined> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) return undefined
    return data as Job
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) return undefined
    return data as Job
  }

  async createTempFileData(jobId: string, source: string, filename: string, columns: string[], rows: any[]): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase
      .from('temp_file_data')
      .insert({
        job_id: jobId,
        source,
        filename,
        columns,
        rows,
      })
    
    if (error) throw error
  }

  async getTempFileData(jobId: string, source: string): Promise<{ columns: string[]; rows: any[] } | null> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('temp_file_data')
      .select('columns, rows')
      .eq('job_id', jobId)
      .eq('source', source)
      .single()
    
    if (error) return null
    return data as { columns: string[]; rows: any[] }
  }

  async deleteTempFileData(jobId: string): Promise<void> {
    const supabase = await createClient()
    await supabase
      .from('temp_file_data')
      .delete()
      .eq('job_id', jobId)
  }

  // Transaction Records
  async createTransactionRecord(record: InsertTransactionRecord): Promise<TransactionRecord> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('transaction_records')
      .insert(record)
      .select()
      .single()
    
    if (error) throw error
    return data as TransactionRecord
  }

  async createTransactionRecords(records: InsertTransactionRecord[]): Promise<TransactionRecord[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('transaction_records')
      .insert(records)
      .select()
    
    if (error) throw error
    return data as TransactionRecord[]
  }

  async getTransactionsByJob(jobId: string): Promise<TransactionRecord[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('transaction_records')
      .select('*')
      .eq('job_id', jobId)
    
    if (error) return []
    return data as TransactionRecord[]
  }

  async getTransactionsByJobAndSource(jobId: string, source: "payout" | "ledger"): Promise<TransactionRecord[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('transaction_records')
      .select('*')
      .eq('job_id', jobId)
      .eq('source', source)
    
    if (error) return []
    return data as TransactionRecord[]
  }

  // NEW FUNCTION: Get total transaction count (not just unmatched)
  async getTransactionCount(
    jobId: string, 
    source: "payout" | "ledger", 
    searchQuery?: string
  ): Promise<number> {
    const supabase = await createClient()
    let query = supabase
      .from('transaction_records')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .eq('source', source)
    
    if (searchQuery) {
      query = query.or(`tx_id.ilike.%${searchQuery}%,reference.ilike.%${searchQuery}%`)
    }
    
    const { count, error } = await query
    
    if (error) {
      console.error('Error getting transaction count:', error)
      return 0
    }
    
    return count || 0
  }

  async getUnmatchedTransactions(jobId: string, source: "payout" | "ledger", matchedIds: string[]): Promise<TransactionRecord[]> {
    const supabase = await createClient()
    let query = supabase
      .from('transaction_records')
      .select('*')
      .eq('job_id', jobId)
      .eq('source', source)
    
    if (matchedIds.length > 0) {
      query = query.not('id', 'in', `(${matchedIds.join(',')})`)
    }
    
    const { data, error } = await query
    if (error) return []
    return data as TransactionRecord[]
  }

  async getUnmatchedTransactionsPaginated(
    jobId: string, 
    source: "payout" | "ledger", 
    matchedIds: string[], 
    limit?: number, 
    offset?: number,
    searchQuery?: string
  ): Promise<TransactionRecord[]> {
    const supabase = await createClient()
    let query = supabase
      .from('transaction_records')
      .select('*')
      .eq('job_id', jobId)
      .eq('source', source)
      .order('timestamp', { ascending: false })
    
    if (matchedIds.length > 0) {
      query = query.not('id', 'in', `(${matchedIds.join(',')})`)
    }
    
    if (searchQuery) {
      query = query.or(`tx_id.ilike.%${searchQuery}%,reference.ilike.%${searchQuery}%`)
    }
    
    if (limit) {
      query = query.limit(limit)
    }
    
    if (offset !== undefined) {
      query = query.range(offset, offset + (limit || 10) - 1)
    }
    
    const { data, error } = await query
    if (error) return []
    return data as TransactionRecord[]
  }

  async getUnmatchedTransactionsCount(
    jobId: string, 
    source: "payout" | "ledger", 
    matchedIds: string[], 
    searchQuery?: string
  ): Promise<number> {
    const supabase = await createClient()
    let query = supabase
      .from('transaction_records')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .eq('source', source)
    
    if (matchedIds.length > 0) {
      query = query.not('id', 'in', `(${matchedIds.join(',')})`)
    }
    
    if (searchQuery) {
      query = query.or(`tx_id.ilike.%${searchQuery}%,reference.ilike.%${searchQuery}%`)
    }
    
    const { count, error } = await query
    
    if (error) {
      console.error('Error getting unmatched transactions count:', error)
      return 0
    }
    
    return count || 0
  }

  async getTransactionById(id: string): Promise<TransactionRecord | undefined> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('transaction_records')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) return undefined
    return data as TransactionRecord
  }

  // Match Records
  async createMatchRecord(record: InsertMatchRecord): Promise<MatchRecord> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('match_records')
      .insert(record)
      .select()
      .single()
    
    if (error) throw error
    return data as MatchRecord
  }

  async createMatchRecords(records: InsertMatchRecord[]): Promise<MatchRecord[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('match_records')
      .insert(records)
      .select()
    
    if (error) throw error
    return data as MatchRecord[]
  }

  async getMatchesByJob(jobId: string): Promise<MatchRecord[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('match_records')
      .select('*')
      .eq('job_id', jobId)
    
    if (error) return []
    return data as MatchRecord[]
  }

  async getMatchesByJobPaginated(
    jobId: string, 
    limit?: number, 
    offset?: number, 
    searchQuery?: string
  ): Promise<MatchRecord[]> {
    const supabase = await createClient()
    let query = supabase
      .from('match_records')
      .select('*')
      .eq('job_id', jobId)
      .order('matched_at', { ascending: false })
    
    if (searchQuery) {
      query = query.or(`payout.tx_id.ilike.%${searchQuery}%,ledger.tx_id.ilike.%${searchQuery}%`)
    }
    
    if (limit) {
      query = query.limit(limit)
    }
    
    if (offset !== undefined) {
      query = query.range(offset, offset + (limit || 10) - 1)
    }
    
    const { data, error } = await query
    if (error) return []
    return data as MatchRecord[]
  }

  async getMatchesCount(jobId: string, searchQuery?: string): Promise<number> {
    const supabase = await createClient()
    let query = supabase
      .from('match_records')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId)
    
    if (searchQuery) {
      query = query.or(`payout.tx_id.ilike.%${searchQuery}%,ledger.tx_id.ilike.%${searchQuery}%`)
    }
    
    const { count, error } = await query
    
    if (error) {
      console.error('Error getting matches count:', error)
      return 0
    }
    
    return count || 0
  }

  async getMatchById(id: string): Promise<MatchRecord | undefined> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('match_records')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) return undefined
    return data as MatchRecord
  }

  async updateMatch(id: string, updates: Partial<MatchRecord>): Promise<MatchRecord | undefined> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('match_records')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    
    if (error) return undefined
    return data as MatchRecord
  }

  async getMatchWithTransactions(id: string): Promise<(MatchRecord & { payout: TransactionRecord; ledger: TransactionRecord }) | undefined> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('match_records')
      .select(`
        *,
        payout:transaction_records!match_records_payout_id_fkey(*),
        ledger:transaction_records!match_records_ledger_id_fkey(*)
      `)
      .eq('id', id)
      .single()
    
    if (error) return undefined
    return data as any
  }

  async getMatchesWithTransactions(jobId: string): Promise<(MatchRecord & { payout: TransactionRecord; ledger: TransactionRecord })[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('match_records')
      .select(`
        *,
        payout:transaction_records!match_records_payout_id_fkey(*),
        ledger:transaction_records!match_records_ledger_id_fkey(*)
      `)
      .eq('job_id', jobId)
    
    if (error) return []
    return data as any[]
  }

  async getMatchesWithTransactionsPaginated(
    jobId: string, 
    limit?: number, 
    offset?: number, 
    searchQuery?: string
  ): Promise<(MatchRecord & { payout: TransactionRecord; ledger: TransactionRecord })[]> {
    const supabase = await createClient()
    let query = supabase
      .from('match_records')
      .select(`
        *,
        payout:transaction_records!match_records_payout_id_fkey(*),
        ledger:transaction_records!match_records_ledger_id_fkey(*)
      `)
      .eq('job_id', jobId)
      .order('matched_at', { ascending: false })
    
    if (searchQuery) {
      query = query.or(`payout.tx_id.ilike.%${searchQuery}%,ledger.tx_id.ilike.%${searchQuery}%`)
    }
    
    if (limit) {
      query = query.limit(limit)
    }
    
    if (offset !== undefined) {
      query = query.range(offset, offset + (limit || 10) - 1)
    }
    
    const { data, error } = await query
    if (error) return []
    return data as any[]
  }

  // Clusters
  async createCluster(cluster: InsertCluster): Promise<Cluster> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('clusters')
      .insert(cluster)
      .select()
      .single()
    
    if (error) throw error
    return data as Cluster
  }

  async createClusters(clusterData: InsertCluster[]): Promise<Cluster[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('clusters')
      .insert(clusterData)
      .select()
    
    if (error) throw error
    return data as Cluster[]
  }

  async getClustersByJob(jobId: string): Promise<Cluster[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('clusters')
      .select('*')
      .eq('job_id', jobId)
    
    if (error) return []
    return data as Cluster[]
  }

  async getClustersByJobPaginated(jobId: string, limit?: number, offset?: number): Promise<Cluster[]> {
    const supabase = await createClient()
    let query = supabase
      .from('clusters')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
    
    if (limit) {
      query = query.limit(limit)
    }
    
    if (offset !== undefined) {
      query = query.range(offset, offset + (limit || 10) - 1)
    }
    
    const { data, error } = await query
    if (error) return []
    return data as Cluster[]
  }

  async getClustersCount(jobId: string): Promise<number> {
    const supabase = await createClient()
    const { count, error } = await supabase
      .from('clusters')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId)
    
    if (error) {
      console.error('Error getting clusters count:', error)
      return 0
    }
    
    return count || 0
  }

  async getClusterById(id: string): Promise<Cluster | undefined> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('clusters')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) return undefined
    return data as Cluster
  }

  async updateCluster(id: string, updates: Partial<Cluster>): Promise<Cluster | undefined> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('clusters')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) return undefined
    return data as Cluster
  }

  // Audit Logs
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('audit_logs')
      .insert(log)
      .select()
      .single()
    
    if (error) throw error
    return data as AuditLog
  }

  async getAuditLogsByJob(jobId: string): Promise<AuditLog[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('job_id', jobId)
    
    if (error) return []
    return data as AuditLog[]
  }
}

export const storage = new SupabaseStorage()