import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Button, List, Chip, ActivityIndicator } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';

interface WalletData {
  address: string;
  curatedName?: string;
  pnl7d?: number;
  pnl30d?: number;
  isTracked: boolean;
}

interface ApiResponse {
  success: boolean;
  data: {
    totalTracked: number;
    leaderboardWallets: WalletData[];
  };
}

const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount.toFixed(2)}`;
};

const formatAddress = (address: string): string => {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

export function LeaderboardScreen() {
  const { data, isLoading, error, refetch } = useQuery<ApiResponse>({
    queryKey: ['wallet-tracker-summary'],
    queryFn: async () => {
      const response = await fetch('http://localhost:3000/api/v1/wallet-tracker/summary');
      if (!response.ok) {
        throw new Error('Failed to fetch wallet data');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading Alpha Seekers...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load data</Text>
        <Button mode="contained" onPress={handleRefresh} style={styles.retryButton}>
          Retry
        </Button>
      </View>
    );
  }

  const walletData = data?.data;
  const leaderboardWallets = walletData?.leaderboardWallets || [];
  const walletsWithPnl = leaderboardWallets.filter(wallet => wallet.pnl7d || wallet.pnl30d);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.headerContainer}>
        <Text variant="headlineMedium" style={styles.title}>
          🏆 Alpha Seekers Leaderboard
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Track the top performing Solana wallets
        </Text>
      </View>

      {/* Summary Stats */}
      <Card style={styles.summaryCard}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.summaryTitle}>
            📊 Summary
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text variant="headlineSmall" style={styles.statNumber}>
                {walletData?.totalTracked?.toLocaleString() || 0}
              </Text>
              <Text variant="bodySmall">Total Tracked</Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="headlineSmall" style={styles.statNumber}>
                {walletsWithPnl.length}
              </Text>
              <Text variant="bodySmall">Top Performers</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Leaderboard */}
      <Card style={styles.leaderboardCard}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.leaderboardTitle}>
            🥇 Top Performers
          </Text>
          
          {leaderboardWallets.length === 0 ? (
            <Text style={styles.noDataText}>No wallet data available</Text>
          ) : (
            leaderboardWallets.map((wallet, index) => (
              <List.Item
                key={wallet.address}
                title={wallet.curatedName || formatAddress(wallet.address)}
                description={`Address: ${formatAddress(wallet.address)}`}
                left={() => (
                  <View style={styles.rankContainer}>
                    <Text style={styles.rankText}>#{index + 1}</Text>
                  </View>
                )}
                right={() => (
                  <View style={styles.pnlContainer}>
                    {wallet.pnl7d && (
                      <Chip
                        mode="flat"
                        style={[styles.pnlChip, { backgroundColor: '#e8f5e8' }]}
                        textStyle={styles.pnlText}
                      >
                        7D: {formatCurrency(wallet.pnl7d)}
                      </Chip>
                    )}
                    {wallet.pnl30d && (
                      <Chip
                        mode="flat"
                        style={[styles.pnlChip, { backgroundColor: '#e8f8ff' }]}
                        textStyle={styles.pnlText}
                      >
                        30D: {formatCurrency(wallet.pnl30d)}
                      </Chip>
                    )}
                  </View>
                )}
                style={styles.walletItem}
              />
            ))
          )}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
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
  summaryCard: {
    marginBottom: 16,
  },
  summaryTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontWeight: 'bold',
    color: '#2196f3',
  },
  leaderboardCard: {
    marginBottom: 16,
  },
  leaderboardTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  noDataText: {
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 16,
  },
  walletItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 8,
  },
  rankContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
  },
  rankText: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#ff6b35',
  },
  pnlContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  pnlChip: {
    marginVertical: 2,
    minWidth: 80,
  },
  pnlText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
}); 