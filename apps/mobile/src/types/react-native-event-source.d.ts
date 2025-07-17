declare module 'react-native-event-source' {
  export interface EventSourceOptions {
    withCredentials?: boolean;
    headers?: { [key: string]: string };
  }

  export default class EventSource {
    constructor(url: string, options?: EventSourceOptions);
    addEventListener(type: string, listener: (event: any) => void): void;
    removeEventListener(type: string, listener: (event: any) => void): void;
    close(): void;
    readyState: number;
    url: string;
    withCredentials: boolean;
    
    static readonly CONNECTING: number;
    static readonly OPEN: number;
    static readonly CLOSED: number;
    
    onopen: ((event: any) => void) | null;
    onmessage: ((event: any) => void) | null;
    onerror: ((event: any) => void) | null;
  }
} 