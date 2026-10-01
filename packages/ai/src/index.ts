/** Phase 0 contracts only. No provider calls are implemented. */
export interface ChatModel {
  id: string;
  providerId: string;
  contextWindow?: number;
}

export interface EmbeddingModel {
  id: string;
  providerId: string;
  dimensions?: number;
}

export interface VisionModel {
  id: string;
  providerId: string;
}

export interface TranscriptionModel {
  id: string;
  providerId: string;
}

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  listModels(signal?: AbortSignal): Promise<readonly string[]>;
  testConnection(signal?: AbortSignal): Promise<void>;
}
