
export type MessageRole = 'user' | 'model';

export interface ChatMessageImage {
  id: string;
  data?: string; // base64 encoded image, optional as it will be loaded from IndexedDB
  type: 'uploaded' | 'generated';
  mimeType: string;
}

export interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  };
}

export interface AIMessage {
  id:string;
  role: MessageRole;
  text?: string;
  images?: ChatMessageImage[];
  isLoading?: boolean;
  suggestions?: string[];
  groundingChunks?: GroundingChunk[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: string;
}
