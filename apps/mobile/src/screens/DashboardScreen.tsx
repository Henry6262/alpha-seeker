import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Button, ProgressBar, Chip, ActivityIndicator } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';

interface HealthData {
  status: string;
  environment: string;
  limits: {
    maxTrackableWallets: number;
    maxWalletsConfigured: number;
    maxConcurrentStreams: number;
    maxAccountsPerStream: number;
  };
}

interface WalletTrackerData {
  totalTracked: number;
  leaderboardWallets: Array<{
    address: string;
    curatedName?: string;
    pnl7d?: number;
    pnl30d?: number;
    isTracked: boolean;
  }>;
}

const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount.toFixed(2)}`;
};

export function DashboardScreen() {
  const { data: healthData, isLoading: healthLoading } = useQuery<HealthData>({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await fetch('http://localhost:3000/health');
      if (!response.ok) throw new Error('Failed to fetch health data');
      return response.json();
    },
  });

  const { data: walletData, isLoading: walletLoading, refetch } = useQuery<{ data: WalletTrackerData }>({
    queryKey: ['wallet-tracker-summary'],
    queryFn: async () => {
      const response = await fetch('http://localhost:3000/api/v1/wallet-tracker/summary');
      if (!response.ok) throw new Error('Failed to fetch wallet data');
      return response.json();
    },
    refetchInterval: 30000,
  });

  const isLoading = healthLoading || walletLoading;

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading Dashboard...</Text>
      </View>
    );
  }

  const walletTrackerData = walletData?.data;
  const walletsWithPnl = walletTrackerData?.leaderboardWallets?.filter(w => w.pnl7d || w.pnl30d) || [];
  const totalPnl7d = walletsWithPnl.reduce((sum, wallet) => sum + (wallet.pnl7d || 0), 0);
  const totalPnl30d = walletsWithPnl.reduce((sum, wallet) => sum + (wallet.pnl30d || 0), 0);
  const avgPnl7d = walletsWithPnl.length > 0 ? totalPnl7d / walletsWithPnl.length : 0;
  const avgPnl30d = walletsWithPnl.length > 0 ? totalPnl30d / walletsWithPnl.length : 0;

  const trackingProgress = healthData?.limits ? 
    (walletTrackerData?.totalTracked || 0) / healthData.limits.maxTrackableWallets : 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.headerContainer}>
        <Text variant="headlineMedium" style={styles.title}>
          📊 Alpha Seeker Dashboard
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Real-time Solana trading intelligence
        </Text>
      </View>

      {/* System Status */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.cardTitle}>
            🔥 System Status
          </Text>
          <View style={styles.statusRow}>
            <Chip
              mode="flat"
              style={[styles.statusChip, { backgroundColor: '#e8f5e8' }]}
              textStyle={styles.statusText}
            >
              {healthData?.status === 'ok' ? '✅ Online' : '❌ Offline'}
            </Chip>
            <Chip
              mode="flat"
              style={[styles.statusChip, { backgroundColor: '#e8f8ff' }]}
              textStyle={styles.statusText}
            >
              {healthData?.environment || 'Unknown'}
            </Chip>
          </View>
        </Card.Content>
      </Card>

      {/* Key Metrics */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.cardTitle}>
            📈 Key Metrics
          </Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text variant="headlineSmall" style={styles.metricNumber}>
                {walletTrackerData?.totalTracked?.toLocaleString() || 0}
              </Text>
              <Text variant="bodySmall">Wallets Tracked</Text>
            </View>
            <View style={styles.metricItem}>
              <Text variant="headlineSmall" style={styles.metricNumber}>
                {walletsWithPnl.length}
              </Text>
              <Text variant="bodySmall">Profitable Wallets</Text>
            </View>
            <View style={styles.metricItem}>
              <Text variant="headlineSmall" style={styles.metricNumber}>
                {formatCurrency(totalPnl7d)}
              </Text>
              <Text variant="bodySmall">Total PnL (7D)</Text>
            </View>
            <View style={styles.metricItem}>
              <Text variant="headlineSmall" style={styles.metricNumber}>
                {formatCurrency(avgPnl7d)}
              </Text>
              <Text variant="bodySmall">Avg PnL (7D)</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Tracking Progress */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.cardTitle}>
            🎯 Tracking Progress
          </Text>
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text variant="bodyMedium">Wallet Capacity</Text>
              <Text variant="bodyMedium">
                {walletTrackerData?.totalTracked || 0} / {healthData?.limits?.maxTrackableWallets || 250}
              </Text>
            </View>
            <ProgressBar 
              progress={trackingProgress} 
              style={styles.progressBar}
              color="#2196f3"
            />
            <Text variant="bodySmall" style={styles.progressText}>
              {(trackingProgress * 100).toFixed(1)}% capacity utilized
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Performance Insights */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.cardTitle}>
            💡 Performance Insights
          </Text>
          <View style={styles.insightsContainer}>
            <View style={styles.insightItem}>
              <Text variant="titleMedium">🔥 Top Performer</Text>
              <Text variant="bodyMedium">
                {walletsWithPnl.length > 0 ? 
                  `${formatCurrency(Math.max(...walletsWithPnl.map(w => w.pnl7d || 0)))} in 7 days` :
                  'No data available'
                }
              </Text>
            </View>
            <View style={styles.insightItem}>
              <Text variant="titleMedium">📊 Success Rate</Text>
              <Text variant="bodyMedium">
                {walletTrackerData?.totalTracked && walletsWithPnl.length ?
                  `${((walletsWithPnl.length / walletTrackerData.totalTracked) * 100).toFixed(1)}% profitable` :
                  'Calculating...'
                }
              </Text>
            </View>
            <View style={styles.insightItem}>
              <Text variant="titleMedium">⚡ Data Freshness</Text>
              <Text variant="bodyMedium">
                Real-time updates every 30 seconds
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Quick Actions */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.cardTitle}>
            ⚡ Quick Actions
          </Text>
          <View style={styles.actionsContainer}>
            <Button
              mode="contained"
              style={styles.actionButton}
              onPress={handleRefresh}
            >
              🔄 Refresh Data
            </Button>
            <Button
              mode="outlined"
              style={styles.actionButton}
              onPress={() => {/* Navigate to leaderboard */}}
            >
              🏆 View Leaderboard
            </Button>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  headerContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.7,
  },
  card: {
    marginBottom: 16,
  },
  cardTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusChip: {
    flex: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricItem: {
    alignItems: 'center',
    width: '48%',
    marginBottom: 16,
  },
  metricNumber: {
    fontWeight: 'bold',
    color: '#2196f3',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  progressText: {
    marginTop: 4,
    textAlign: 'center',
    opacity: 0.7,
  },
  insightsContainer: {
    gap: 12,
  },
  insightItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
}); 