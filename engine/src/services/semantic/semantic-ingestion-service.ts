/**
 * Semantic Ingestion Service for ECE (Semantic Shift Refactor)
 * 
 * Replaces the old atomizer with semantic molecule processing
 * that creates high-level semantic tags and atomic entities.
 */

import { SemanticMoleculeProcessor } from './semantic-molecule-processor.js';
import { SemanticMolecule } from './types/semantic.js';
import { db } from '../../core/db.js';
import * as crypto from 'crypto';

export class SemanticIngestionService {
  private moleculeProcessor: SemanticMoleculeProcessor;

  constructor() {
    this.moleculeProcessor = new SemanticMoleculeProcessor();
  }

  /**
   * Ingest content using the new semantic architecture
   * Creates molecules with high-level semantic tags and atomic entities
   */
  public async ingestContent(
    content: string,
    source: string,
    type: string = 'text',
    bucket: string = 'default',
    buckets: string[] = [],
    tags: string[] = [] // These will be high-level semantic categories
  ): Promise<{ status: string; id: string; message: string }> {
    try {
      // Handle legacy single-bucket param
      const allBuckets = bucket ? [...buckets, bucket] : buckets;

      // Split content into text chunks (molecules)
      const textChunks = this.splitIntoMolecules(content);
      
      // Process each chunk into semantic molecules
      const chunksWithMetadata = textChunks.map((chunk, index) => ({
        content: chunk,
        source: `${source}_chunk_${index}`,
        timestamp: Date.now() + index, // Slightly offset timestamps
        provenance: 'external'
      }));

      const semanticMolecules = await this.moleculeProcessor.processTextChunks(chunksWithMetadata);

      // Store each semantic molecule in the database
      for (const molecule of semanticMolecules) {
        const id = `mol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = molecule.timestamp;
        const hash = crypto.createHash('sha256').update(molecule.content).digest('hex');

        // Insert the semantic molecule into the database
        await db.run(
          `INSERT INTO atoms (id, timestamp, content, source_path, source_id, sequence, type, hash, buckets, tags, epochs, provenance, simhash, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (id) DO UPDATE SET
             content = EXCLUDED.content,
             timestamp = EXCLUDED.timestamp,
             source_path = EXCLUDED.source_path,
             source_id = EXCLUDED.source_id,
             sequence = EXCLUDED.sequence,
             type = EXCLUDED.type,
             hash = EXCLUDED.hash,
             buckets = EXCLUDED.buckets,
             tags = EXCLUDED.tags,
             epochs = EXCLUDED.epochs,
             provenance = EXCLUDED.provenance,
             simhash = EXCLUDED.simhash,
             embedding = EXCLUDED.embedding`,
          [
            id,
            timestamp,
            molecule.content,
            source,
            source, // source_id
            0, // sequence
            type || 'semantic_molecule',
            hash,
            allBuckets,
            [...tags, ...molecule.semanticTags.map((tag: string) => tag.replace('#', ''))], // Convert semantic categories to tags
            [], // epochs
            molecule.provenance,
            "0", // simhash (default)
            new Array(768).fill(0.1) // Zero-stub for now
          ]
        );

        // Also store the atomic entities separately if needed
        for (const entity of molecule.containedEntities) {
          const atomId = `atom_${id}_${entity}`;
          const atomHash = crypto.createHash('sha256').update(entity).digest('hex');
          
          await db.run(
            `INSERT INTO atoms (id, timestamp, content, source_path, source_id, sequence, type, hash, buckets, tags, epochs, provenance, simhash, embedding)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (id) DO UPDATE SET
               content = EXCLUDED.content,
               timestamp = EXCLUDED.timestamp,
               source_path = EXCLUDED.source_path,
               source_id = EXCLUDED.source_id,
               sequence = EXCLUDED.sequence,
               type = EXCLUDED.type,
               hash = EXCLUDED.hash,
               buckets = EXCLUDED.buckets,
               tags = EXCLUDED.tags,
               epochs = EXCLUDED.epochs,
               provenance = EXCLUDED.provenance,
               simhash = EXCLUDED.simhash,
               embedding = EXCLUDED.embedding`,
            [
              atomId,
              timestamp,
              entity, // The atomic entity value
              `${source}_entities`,
              id, // source_id points to the parent molecule
              0, // sequence
              'atomic_entity',
              atomHash,
              [...allBuckets, 'entities'], // Add to entities bucket
              [`entity:${entity.toLowerCase()}`, ...molecule.semanticTags.map((tag: string) => tag.replace('#', ''))], // Entity-specific and semantic tags
              [], // epochs
              'internal',
              "0", // simhash
              new Array(768).fill(0.1)
            ]
          );
        }
      }

      return { 
        status: 'success', 
        id: semanticMolecules[0]?.id || 'unknown', 
        message: `Ingested ${semanticMolecules.length} semantic molecules with ${semanticMolecules.reduce((sum, mol) => sum + mol.containedEntities.length, 0)} atomic entities` 
      };
    } catch (e: any) {
      console.error('[SemanticIngestionService] Ingest Error:', e);
      return { status: 'error', id: 'unknown', message: e.message };
    }
  }

  /**
   * Split content into semantic molecules (text chunks)
   * This replaces the old atomizer logic
   */
  private splitIntoMolecules(content: string): string[] {
    // Split by paragraphs or sentences, preserving semantic meaning
    // This is a simplified version - could be enhanced with more sophisticated NLP
    
    // First, try to split by paragraphs
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    // If paragraphs are too long, split further by sentences
    const chunks: string[] = [];
    for (const paragraph of paragraphs) {
      if (paragraph.length <= 500) { // Max length for a semantic molecule
        chunks.push(paragraph.trim());
      } else {
        // Split long paragraphs into sentences
        const sentences = this.splitIntoSentences(paragraph);
        let currentChunk = '';
        
        for (const sentence of sentences) {
          if ((currentChunk + ' ' + sentence).length > 500) {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
            }
            currentChunk = sentence;
          } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          }
        }
        
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
      }
    }
    
    return chunks.filter(chunk => chunk.length > 10); // Filter out very short chunks
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting - could be enhanced with NLP
    return text
      .split(/(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|\!)\s+/g)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Process a single text chunk into a semantic molecule
   */
  public async processSingleChunk(
    content: string,
    source: string,
    timestamp: number = Date.now()
  ): Promise<SemanticMolecule> {
    return await this.moleculeProcessor.processTextChunk(content, source, timestamp);
  }
}