import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, ActivityIndicator, Chip, Divider } from 'react-native-paper';
import { apiService, LeaderboardResponse } from '../services/api';

export default function LeaderboardScreen() {
  const [loading, setLoading] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<any>(null);
  const [timeframe, setTimeframe] = useState<'1h' | '1d' | '7d' | '30d'>('1d');

  useEffect(() => {
    loadLeaderboardData();
    checkApiStatus();
  }, [timeframe]);

  const loadLeaderboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiService.getLeaderboard({
        timeframe,
        limit: 50
      });
      setLeaderboardData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const checkApiStatus = async () => {
    try {
      const [health, bootstrap, config] = await Promise.all([
        apiService.getHealth(),
        apiService.getBootstrapStatus(),
        apiService.getConfig()
      ]);
      setApiStatus({ health, bootstrap, config });
    } catch (err) {
      console.error('Failed to check API status:', err);
    }
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

    return (
      <Card style={styles.statusCard}>
        <Card.Title title="🔗 API Connection Status" />
        <Card.Content>
          <Text style={styles.statusText}>
            ✅ API Health: {apiStatus.health?.status === 'ok' ? 'Connected' : 'Disconnected'}
          </Text>
          <Text style={styles.statusText}>
            📊 Bootstrap: {apiStatus.bootstrap?.data?.isBootstrapped ? 'Complete' : 'Pending'}
          </Text>
          <Text style={styles.statusText}>
            👥 Wallets Tracked: {apiStatus.bootstrap?.data?.walletsCount || 0}
          </Text>
          <Text style={styles.statusText}>
            📈 PNL Snapshots: {apiStatus.bootstrap?.data?.pnlSnapshots7d || 0}
          </Text>
          <Text style={styles.statusText}>
            ⭐ Famous Traders: {apiStatus.bootstrap?.data?.famousTraders || 0}
          </Text>
        </Card.Content>
      </Card>
    );
  };

  const renderLeaderboardData = () => {
    if (!leaderboardData) return null;

    return (
      <Card style={styles.dataCard}>
        <Card.Title title="📊 Leaderboard Data" />
        <Card.Content>
          <Text style={styles.filterText}>
            Timeframe: {leaderboardData.filters.timeframe} | 
            Ecosystem: {leaderboardData.filters.ecosystem} | 
            Type: {leaderboardData.filters.type}
          </Text>
          <Divider style={styles.divider} />
          
          {leaderboardData.data.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>⚠️ No data available</Text>
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
            leaderboardData.data.map((entry, index) => (
              <View key={entry.id} style={styles.leaderboardItem}>
                <Text style={styles.rank}>#{entry.rank}</Text>
                <View style={styles.walletInfo}>
                  <Text style={styles.wallet}>
                    {entry.walletAddress.slice(0, 4)}...{entry.walletAddress.slice(-4)}
                  </Text>
                  <Text style={styles.address}>{entry.walletAddress}</Text>
                </View>
                <View style={styles.pnlInfo}>
                  <Text style={styles.pnl}>
                    ${(entry.metric / 1000).toFixed(1)}K
                  </Text>
                  <Text style={styles.pnlLabel}>PNL USD</Text>
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
        <Text style={styles.subtitle}>Top Solana Traders</Text>
      </View>

      {renderTimeframeChips()}
      {renderApiStatus()}
      
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
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

      {!loading && !error && renderLeaderboardData()}
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
  filterText: {
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
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
    marginBottom: 4,
    borderRadius: 8,
  },
  rank: {
    fontSize: 16,
    fontWeight: 'bold',
    width: 50,
    color: '#ff6b35',
  },
  walletInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  wallet: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#333',
  },
  address: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#666',
    marginTop: 2,
  },
  pnlInfo: {
    alignItems: 'flex-end',
  },
  pnl: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4caf50',
  },
  pnlLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
  },
  errorCard: {
    marginBottom: 16,
    backgroundColor: '#ffebee',
  },
  errorText: {
    color: '#d32f2f',
    marginBottom: 8,
  },
}); 