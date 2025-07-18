import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, ActivityIndicator, Chip, Divider, SegmentedButtons, Badge } from 'react-native-paper';
import { 
  apiService, 
  LeaderboardResponse, 
  KolLeaderboardResponse, 
  EcosystemLeaderboardResponse,
  KolLeaderboardEntry,
  EcosystemLeaderboardEntry
} from '../services/api';
import { sseService, SSEMessage } from '../services/sse';

type LeaderboardType = 'kol' | 'ecosystem';

export default function LeaderboardScreen() {
  const [loading, setLoading] = useState(false);
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('kol');
  const [kolData, setKolData] = useState<KolLeaderboardResponse | null>(null);
  const [ecosystemData, setEcosystemData] = useState<EcosystemLeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<any>(null);
  const [timeframe, setTimeframe] = useState<'1h' | '1d' | '7d' | '30d'>('1d');
  
  // Real-time state
  const [isSSEConnected, setIsSSEConnected] = useState(false);
  const [sseError, setSSEError] = useState<string | null>(null);
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  const [updateCount, setUpdateCount] = useState(0);
  const lastUpdateTime = useRef<Date>(new Date());

  useEffect(() => {
    loadLeaderboardData();
    checkApiStatus();
  }, [timeframe, leaderboardType]);

  // Setup real-time connections
  useEffect(() => {
    if (realtimeEnabled && leaderboardType === 'kol') {
      connectToRealtimeUpdates();
    } else {
      disconnectFromRealtimeUpdates();
    }

    return () => {
      disconnectFromRealtimeUpdates();
    };
  }, [realtimeEnabled, leaderboardType, timeframe]);

  const connectToRealtimeUpdates = () => {
    console.log('🔗 Connecting to real-time leaderboard updates...');
    
    sseService.connectToLeaderboard(timeframe, {
      autoReconnect: true,
      maxReconnectAttempts: 10,
      reconnectDelay: 2000,
      heartbeatTimeout: 70000
    }, {
      onOpen: () => {
        console.log('✅ SSE leaderboard connection established');
        setIsSSEConnected(true);
        setSSEError(null);
      },
      onMessage: (message: SSEMessage) => {
        handleRealtimeMessage(message);
      },
      onError: (error) => {
        console.error('❌ SSE leaderboard error:', error);
        setIsSSEConnected(false);
        setSSEError('Connection lost - attempting to reconnect...');
      },
      onClose: () => {
        console.log('🔌 SSE leaderboard connection closed');
        setIsSSEConnected(false);
      }
    });
  };

  const disconnectFromRealtimeUpdates = () => {
    console.log('🔌 Disconnecting from real-time updates');
    sseService.disconnect();
    setIsSSEConnected(false);
  };

  const handleRealtimeMessage = (message: SSEMessage) => {
    console.log('📨 Real-time message received:', message.type);
    
    switch (message.type) {
      case 'heartbeat':
        // Just update connection status
        lastUpdateTime.current = new Date();
        break;
        
      case 'leaderboard':
        if (message.data && leaderboardType === 'kol') {
          console.log('📊 Received leaderboard update via SSE');
          console.log('📊 Leaderboard data:', JSON.stringify(message.data).substring(0, 200) + '...');
          
          // If we receive actual leaderboard data array, update the state
          if (Array.isArray(message.data.leaderboard)) {
            console.log('📊 Updating leaderboard data from real-time feed with', message.data.leaderboard.length, 'entries');
            setKolData(prevData => ({
              success: true,
              data: message.data.leaderboard,
              meta: {
                timeframe: message.data.timeframe || '1d',
                count: message.data.leaderboard.length,
                source: 'Real-time Stream',
                last_updated: message.data.timestamp || new Date().toISOString()
              }
            } as KolLeaderboardResponse));
            setUpdateCount(prev => prev + 1);
            lastUpdateTime.current = new Date();
          } else {
            // Handle simple update notifications
            console.log('📊 Received leaderboard change notification');
            setUpdateCount(prev => prev + 1);
            lastUpdateTime.current = new Date();
          }
        }
        break;
        
      case 'system':
        if (message.data?.message?.includes('shutdown')) {
          setSSEError('Server is shutting down');
          setIsSSEConnected(false);
        }
        break;
        
      default:
        console.log('🔍 Unhandled message type:', message.type, message.data);
    }
  };

  const toggleRealtimeUpdates = () => {
    setRealtimeEnabled(!realtimeEnabled);
    if (!realtimeEnabled) {
      setUpdateCount(0);
    }
  };

  const loadLeaderboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (leaderboardType === 'kol') {
        const response = await apiService.getKolLeaderboard({
          timeframe,
          limit: 50
        });
        setKolData(response);
      } else {
        const response = await apiService.getEcosystemLeaderboard({
          timeframe,
          limit: 50
        });
        setEcosystemData(response);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const checkApiStatus = async () => {
    try {
      const [health, systemStatus] = await Promise.all([
        apiService.getHealth(),
        apiService.getSystemStatus()
      ]);
      setApiStatus({ health, systemStatus });
    } catch (err) {
      console.error('Failed to check API status:', err);
    }
  };

  const renderLeaderboardTypeSelector = () => {
    return (
      <View style={styles.selectorContainer}>
        <SegmentedButtons
          value={leaderboardType}
          onValueChange={(value) => setLeaderboardType(value as LeaderboardType)}
          buttons={[
            {
              value: 'kol',
              label: '👑 KOL Traders',
              icon: 'star'
            },
            {
              value: 'ecosystem',
              label: '🌍 Ecosystem',
              icon: 'earth'
            }
          ]}
        />
      </View>
    );
  };

  const renderTimeframeChips = () => {
    const timeframes: Array<'1h' | '1d' | '7d' | '30d'> = ['1h', '1d', '7d', '30d'];
    
    return (
      <View style={styles.chipContainer}>
        {timeframes.map((tf) => (
          <Chip
            key={tf}
            selected={timeframe === tf}
            onPress={() => setTimeframe(tf)}
            style={styles.chip}
          >
            {tf}
          </Chip>
        ))}
      </View>
    );
  };

  const renderApiStatus = () => {
    if (!apiStatus) return null;

    const systemStatus = apiStatus.systemStatus?.system_status;
    const liveEngine = systemStatus?.live_engine;
    const infoCache = systemStatus?.info_cache;

    return (
      <Card style={styles.statusCard}>
        <Card.Title title="🔗 System Status" />
        <Card.Content>
          <Text style={styles.statusText}>
            ✅ API Health: {apiStatus.health?.status === 'ok' ? 'Connected' : 'Disconnected'}
          </Text>
          <Text style={styles.statusText}>
            👑 KOL Engine: {liveEngine?.status === 'active' ? 'Active' : 'Inactive'} ({liveEngine?.kol_wallets || 0} wallets)
          </Text>
          <Text style={styles.statusText}>
            🌍 Ecosystem Cache: {infoCache?.status === 'active' ? 'Active' : 'Inactive'} ({infoCache?.dune_entries || 0} entries)
          </Text>
          <Text style={styles.statusText}>
            📊 Architecture: {apiStatus.systemStatus?.architecture || 'Unknown'}
          </Text>
        </Card.Content>
      </Card>
    );
  };

  const renderRealtimeStatus = () => {
    if (leaderboardType !== 'kol') return null;

    return (
      <Card style={styles.realtimeCard}>
        <Card.Content>
          <View style={styles.realtimeHeader}>
            <View style={styles.realtimeInfo}>
              <Text style={styles.realtimeTitle}>📡 Real-time Updates</Text>
              <View style={styles.statusBadges}>
                <Badge 
                  style={[styles.statusBadge, { backgroundColor: isSSEConnected ? '#4CAF50' : '#F44336' }]}
                >
                  {isSSEConnected ? 'Connected' : 'Disconnected'}
                </Badge>
                {updateCount > 0 && (
                  <Badge style={[styles.statusBadge, { backgroundColor: '#2196F3' }]}>
                    {`${updateCount} updates`}
                  </Badge>
                )}
              </View>
            </View>
            <Button 
              mode={realtimeEnabled ? 'contained' : 'outlined'}
              onPress={toggleRealtimeUpdates}
              compact
              style={styles.realtimeToggle}
            >
              {realtimeEnabled ? 'Live' : 'Enable'}
            </Button>
          </View>
          
          {sseError && (
            <Text style={styles.sseErrorText}>⚠️ {sseError}</Text>
          )}
          
          {isSSEConnected && (
            <Text style={styles.lastUpdateText}>
              Last update: {lastUpdateTime.current.toLocaleTimeString()}
            </Text>
          )}
        </Card.Content>
      </Card>
    );
  };

  const renderKolLeaderboard = () => {
    if (!kolData) return null;

    return (
      <Card style={styles.dataCard}>
        <Card.Title title="👑 KOL Traders Leaderboard" />
        <Card.Content>
          <Text style={styles.metaText}>
            Source: {kolData.meta.source} | Last Updated: {new Date(kolData.meta.last_updated).toLocaleString()}
          </Text>
          <Divider style={styles.divider} />
          
          {kolData.data.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>⚠️ No KOL data available</Text>
              <Text style={styles.emptySubtext}>
                Try refreshing or selecting a different timeframe
              </Text>
              <Button 
                mode="contained" 
                onPress={loadLeaderboardData}
                style={styles.retryButton}
              >
                Retry
              </Button>
            </View>
          ) : (
            kolData.data.map((entry, index) => (
              <View key={`${entry.wallet_address}-${index}`} style={styles.leaderboardItem}>
                <Text style={styles.rank}>#{entry.rank}</Text>
                <View style={styles.traderInfo}>
                  <Text style={styles.traderName}>
                    {entry.curated_name || 'Unknown Trader'}
                  </Text>
                  <Text style={styles.twitterHandle}>
                    @{entry.twitter_handle || 'N/A'}
                  </Text>
                  <Text style={styles.address}>
                    {entry.wallet_address.slice(0, 6)}...{entry.wallet_address.slice(-4)}
                  </Text>
                </View>
                <View style={styles.pnlInfo}>
                  <Text style={[styles.pnl, { color: entry.total_pnl_usd >= 0 ? '#4CAF50' : '#F44336' }]}>
                    ${(entry.total_pnl_usd / 1000).toFixed(1)}K
                  </Text>
                  <Text style={styles.pnlLabel}>
                    {entry.win_rate?.toFixed(1)}% WR | {entry.total_trades} trades
                  </Text>
                </View>
              </View>
            ))
          )}
        </Card.Content>
      </Card>
    );
  };

  const renderEcosystemLeaderboard = () => {
    if (!ecosystemData) return null;

    return (
      <Card style={styles.dataCard}>
        <Card.Title title="🌍 Ecosystem Leaderboard" />
        <Card.Content>
          <Text style={styles.metaText}>
            Source: {ecosystemData.meta.source} | Last Updated: {new Date(ecosystemData.meta.last_updated).toLocaleString()}
          </Text>
          <Divider style={styles.divider} />
          
          {ecosystemData.data.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>⚠️ No ecosystem data available</Text>
              <Text style={styles.emptySubtext}>
                Try refreshing or selecting a different timeframe
              </Text>
              <Button 
                mode="contained" 
                onPress={loadLeaderboardData}
                style={styles.retryButton}
              >
                Retry
              </Button>
            </View>
          ) : (
            ecosystemData.data.map((entry, index) => (
              <View key={`${entry.wallet_address}-${index}`} style={styles.leaderboardItem}>
                <Text style={styles.rank}>#{entry.rank}</Text>
                <View style={styles.walletInfo}>
                  <Text style={styles.wallet}>
                    {entry.wallet_address.slice(0, 6)}...{entry.wallet_address.slice(-4)}
                  </Text>
                  <Text style={styles.notableWins}>
                    {entry.notable_wins ? 
                      `🏆 Best ROI: ${entry.notable_wins.best_roi.toFixed(1)}% | 💰 Biggest Win: $${(entry.notable_wins.biggest_win / 1000).toFixed(1)}K` : 
                      'No notable wins'
                    }
                  </Text>
                </View>
                <View style={styles.pnlInfo}>
                  <Text style={[styles.pnl, { color: entry.pnl_usd >= 0 ? '#4CAF50' : '#F44336' }]}>
                    ${(entry.pnl_usd / 1000).toFixed(1)}K
                  </Text>
                  <Text style={styles.pnlLabel}>
                    {entry.win_rate?.toFixed(1)}% WR | {entry.total_trades} trades
                  </Text>
                </View>
              </View>
            ))
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🏆 Alpha Seeker Leaderboard</Text>
        <Text style={styles.subtitle}>
          {leaderboardType === 'kol' ? 'Curated KOL Traders' : 'Ecosystem-Wide Rankings'}
        </Text>
      </View>

      {renderLeaderboardTypeSelector()}
      {renderTimeframeChips()}
      {renderRealtimeStatus()}
      {renderApiStatus()}
      
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>
            Loading {leaderboardType === 'kol' ? 'KOL' : 'Ecosystem'} leaderboard...
          </Text>
        </View>
      )}

      {error && (
        <Card style={styles.errorCard}>
          <Card.Content>
            <Text style={styles.errorText}>❌ {error}</Text>
            <Button onPress={loadLeaderboardData} mode="outlined">
              Retry
            </Button>
          </Card.Content>
        </Card>
      )}

      {!loading && !error && (
        leaderboardType === 'kol' ? renderKolLeaderboard() : renderEcosystemLeaderboard()
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196f3',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  selectorContainer: {
    marginBottom: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  chip: {
    marginHorizontal: 4,
  },
  statusCard: {
    marginBottom: 16,
  },
  dataCard: {
    marginBottom: 16,
  },
  statusText: {
    fontSize: 14,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  metaText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  divider: {
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 8,
  },
  leaderboardItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  rank: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196f3',
    width: 40,
  },
  traderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  traderName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  twitterHandle: {
    fontSize: 14,
    color: '#1DA1F2',
    marginTop: 2,
  },
  walletInfo: {
    flex: 1,
    marginLeft: 12,
  },
  wallet: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  address: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  notableWins: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  pnlInfo: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  pnl: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  pnlLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    textAlign: 'right',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorCard: {
    marginBottom: 16,
    backgroundColor: '#ffebee',
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    marginBottom: 12,
  },
  realtimeCard: {
    marginBottom: 16,
    backgroundColor: '#e8f5e8',
  },
  realtimeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  realtimeInfo: {
    flex: 1,
  },
  realtimeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    color: 'white',
    fontSize: 12,
  },
  realtimeToggle: {
    marginLeft: 12,
  },
  sseErrorText: {
    fontSize: 14,
    color: '#F44336',
    marginTop: 4,
  },
  lastUpdateText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
}); 