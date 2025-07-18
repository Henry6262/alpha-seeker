import EventSource from 'react-native-event-source';
import { config, getSSEUrl } from '../config';

export interface SSEMessage {
  type: 'heartbeat' | 'transaction' | 'leaderboard' | 'gem' | 'position' | 'system';
  data: any;
  timestamp: string;
}

export interface SSEConnectionOptions {
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  heartbeatTimeout?: number;
}

export class SSEService {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private autoReconnect = true;
  private heartbeatTimeout = 65000; // 65 seconds
  private heartbeatTimer: any = null;
  private baseUrl: string;
  private onMessage?: (message: SSEMessage) => void;
  private onError?: (error: Event) => void;
  private onOpen?: () => void;
  private onClose?: () => void;

  constructor() {
    this.baseUrl = config.apiBaseUrl;
    console.log('🔧 SSE Service initialized with baseUrl:', this.baseUrl);
  }

  /**
   * Connect to a wallet's transaction feed
   */
  connectToWalletFeed(
    walletAddress: string, 
    options: SSEConnectionOptions = {},
    callbacks: {
      onMessage?: (message: SSEMessage) => void;
      onError?: (error: Event) => void;
      onOpen?: () => void;
      onClose?: () => void;
    } = {}
  ): void {
    this.setupOptions(options);
    this.setupCallbacks(callbacks);
    
    const url = getSSEUrl(`/feed/${walletAddress}`);
    this.connect(url);
  }

  /**
   * Connect to leaderboard updates
   */
  connectToLeaderboard(
    timeframe: string = '1d',
    options: SSEConnectionOptions = {},
    callbacks: {
      onMessage?: (message: SSEMessage) => void;
      onError?: (error: Event) => void;
      onOpen?: () => void;
      onClose?: () => void;
    } = {}
  ): void {
    this.setupOptions(options);
    this.setupCallbacks(callbacks);
    
    const url = getSSEUrl(`/leaderboard?timeframe=${timeframe}`);
    this.connect(url);
  }

  /**
   * Connect to gem discovery alerts
   */
  connectToGems(
    options: SSEConnectionOptions = {},
    callbacks: {
      onMessage?: (message: SSEMessage) => void;
      onError?: (error: Event) => void;
      onOpen?: () => void;
      onClose?: () => void;
    } = {}
  ): void {
    this.setupOptions(options);
    this.setupCallbacks(callbacks);
    
    const url = getSSEUrl('/gems');
    this.connect(url);
  }

  /**
   * Setup connection options
   */
  private setupOptions(options: SSEConnectionOptions): void {
    this.autoReconnect = options.autoReconnect ?? true;
    this.reconnectDelay = options.reconnectDelay ?? 1000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
    this.heartbeatTimeout = options.heartbeatTimeout ?? 65000;
  }

  /**
   * Setup callbacks
   */
  private setupCallbacks(callbacks: {
    onMessage?: (message: SSEMessage) => void;
    onError?: (error: Event) => void;
    onOpen?: () => void;
    onClose?: () => void;
  }): void {
    this.onMessage = callbacks.onMessage;
    this.onError = callbacks.onError;
    this.onOpen = callbacks.onOpen;
    this.onClose = callbacks.onClose;
  }

  /**
   * Connect to SSE endpoint
   */
  private connect(url: string): void {
    try {
      console.log(`🔗 Connecting to SSE: ${url}`);
      
      // Close existing connection
      this.disconnect();
      
      // Create new EventSource
      this.eventSource = new EventSource(url);
      
      // Setup event handlers
      this.eventSource.onopen = (event) => {
        console.log('✅ SSE connection opened');
        this.reconnectAttempts = 0;
        this.startHeartbeatTimer();
        if (this.onOpen) this.onOpen();
      };

      this.eventSource.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.eventSource.onerror = (event) => {
        console.error('❌ SSE connection error:', event);
        this.clearHeartbeatTimer();
        
        if (this.onError) this.onError(event);
        
        if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect(url);
        }
      };

      // Handle specific event types
      this.eventSource.addEventListener('heartbeat', (event) => {
        const messageEvent = event as MessageEvent;
        this.handleMessageWithType(messageEvent, 'heartbeat');
        this.resetHeartbeatTimer();
      });

      this.eventSource.addEventListener('transaction', (event) => {
        const messageEvent = event as MessageEvent;
        this.handleMessageWithType(messageEvent, 'transaction');
      });

      this.eventSource.addEventListener('leaderboard', (event) => {
        const messageEvent = event as MessageEvent;
        this.handleMessageWithType(messageEvent, 'leaderboard');
      });

      this.eventSource.addEventListener('gem', (event) => {
        const messageEvent = event as MessageEvent;
        this.handleMessageWithType(messageEvent, 'gem');
      });

      this.eventSource.addEventListener('position', (event) => {
        const messageEvent = event as MessageEvent;
        this.handleMessageWithType(messageEvent, 'position');
      });

      this.eventSource.addEventListener('system', (event) => {
        const messageEvent = event as MessageEvent;
        this.handleMessageWithType(messageEvent, 'system');
      });

    } catch (error) {
      console.error('❌ Failed to create SSE connection:', error);
      if (this.onError) this.onError(error as Event);
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(event: MessageEvent): void {
    this.handleMessageWithType(event, 'message');
  }

  /**
   * Handle incoming messages with explicit type
   */
  private handleMessageWithType(event: MessageEvent, eventType: string): void {
    try {
      const data = JSON.parse(event.data);
      
      const message: SSEMessage = {
        type: eventType as any,
        data,
        timestamp: data.timestamp || new Date().toISOString()
      };

      console.log(`📨 SSE message - Type: ${eventType}, Data:`, JSON.stringify(data).substring(0, 100) + '...');

      if (this.onMessage) {
        this.onMessage(message);
      }
    } catch (error) {
      console.error('❌ Failed to parse SSE message:', error, event.data);
    }
  }

  /**
   * Start heartbeat timer to detect connection issues
   */
  private startHeartbeatTimer(): void {
    this.clearHeartbeatTimer();
    this.heartbeatTimer = setTimeout(() => {
      console.warn('⚠️ SSE heartbeat timeout - connection may be stale');
      if (this.autoReconnect) {
        this.disconnect();
        // Force reconnect will be triggered by the error handler
      }
    }, this.heartbeatTimeout);
  }

  /**
   * Reset heartbeat timer
   */
  private resetHeartbeatTimer(): void {
    this.clearHeartbeatTimer();
    this.startHeartbeatTimer();
  }

  /**
   * Clear heartbeat timer
   */
  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(url: string): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    console.log(`🔄 Scheduling SSE reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.connect(url);
      } else {
        console.error('❌ Max SSE reconnection attempts reached');
      }
    }, delay);
  }

  /**
   * Disconnect from SSE
   */
  disconnect(): void {
    this.clearHeartbeatTimer();
    
    if (this.eventSource) {
      console.log('🔌 Disconnecting SSE connection');
      this.eventSource.close();
      this.eventSource = null;
      if (this.onClose) this.onClose();
    }
  }

  /**
   * Get connection status
   */
  getConnectionState(): number {
    return this.eventSource?.readyState ?? EventSource.CLOSED;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  /**
   * Check SSE service status
   */
  async checkServiceStatus(): Promise<any> {
    try {
      const response = await fetch(getSSEUrl('/status'));
      return await response.json();
    } catch (error) {
      console.error('❌ Failed to check SSE service status:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const sseService = new SSEService();
export default sseService; 