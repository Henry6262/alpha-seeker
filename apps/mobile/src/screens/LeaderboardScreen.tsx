import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, ActivityIndicator, Chip, Divider, SegmentedButtons } from 'react-native-paper';
import { 
  apiService, 
  LeaderboardResponse, 
  KolLeaderboardResponse, 
  EcosystemLeaderboardResponse,
  KolLeaderboardEntry,
  EcosystemLeaderboardEntry
} from '../services/api';

type LeaderboardType = 'kol' | 'ecosystem';

export default function LeaderboardScreen() {
  const [loading, setLoading] = useState(false);
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('kol');
  const [kolData, setKolData] = useState<KolLeaderboardResponse | null>(null);
  const [ecosystemData, setEcosystemData] = useState<EcosystemLeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<any>(null);
  const [timeframe, setTimeframe] = useState<'1h' | '1d' | '7d' | '30d'>('1d');

  useEffect(() => {
    loadLeaderboardData();
    checkApiStatus();
  }, [timeframe, leaderboardType]);

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
}); 