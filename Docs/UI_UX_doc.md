# UI/UX Documentation for Alpha-Seeker

## Design System Overview

### Brand Identity
- **Primary Theme**: Financial technology with crypto-native aesthetics
- **Target Audience**: Active Solana traders and DeFi enthusiasts
- **Brand Personality**: Professional, cutting-edge, data-driven, mobile-first

### Design Principles
1. **Data Clarity**: Complex financial data presented in digestible, actionable formats
2. **Speed & Efficiency**: Instant access to real-time information with minimal friction
3. **Mobile-First**: Optimized for mobile trading scenarios and on-the-go usage
4. **Trustworthy**: Clean, professional design that instills confidence in financial decisions
5. **Accessibility**: Inclusive design supporting various user needs and abilities

## Technology Stack

### UI Framework
- **React Native Paper**: Material Design components for React Native
- **React Native**: Cross-platform mobile development
- **Expo**: Development platform and build tools
- **TypeScript**: Type-safe development

### Design System
- **Material Design 3**: Modern Material Design principles
- **Paper Theme**: Customizable theme system
- **React Native Paper Components**: Pre-built, accessible components
- **Consistent Spacing**: 8dp grid system following Material Design

## Color Palette

### Primary Colors
```scss
// Primary brand colors
$primary-blue: #2196F3;       // Primary actions, links, navigation
$primary-green: #4CAF50;      // Success, positive PNL, gains
$primary-purple: #9C27B0;     // Premium features, subscriptions
```

### Secondary Colors
```scss
// Status and feedback colors
$secondary-red: #F44336;      // Losses, negative PNL, warnings
$secondary-orange: #FF9800;   // Neutral, pending states
$secondary-gray: #9E9E9E;     // Secondary text, borders
```

### Material Design Colors
```scss
// Material Design 3 color tokens
$surface: #FFFFFF;            // Card backgrounds (light)
$surface-variant: #F5F5F5;    // Elevated surfaces
$on-surface: #1C1C1C;         // Text on surface
$on-surface-variant: #6B6B6B; // Secondary text
$outline: #E0E0E0;            // Borders and dividers
$primary: #2196F3;            // Primary brand color
$on-primary: #FFFFFF;         // Text on primary
```

### Dark Theme Support
```scss
// Dark theme variants
$surface-dark: #121212;       // Card backgrounds (dark)
$surface-variant-dark: #1E1E1E; // Elevated surfaces (dark)
$on-surface-dark: #FFFFFF;    // Text on surface (dark)
$on-surface-variant-dark: #AAAAAA; // Secondary text (dark)
$outline-dark: #333333;       // Borders and dividers (dark)
```

## Typography

### Font System
- **Primary**: System fonts (San Francisco on iOS, Roboto on Android)
- **Monospace**: System monospace for wallet addresses and numbers
- **Font Scale**: Material Design typography scale

### Typography Scale
```scss
// Material Design 3 typography
$headline-large: 32px;       // Page titles, hero text
$headline-medium: 28px;      // Section headings
$headline-small: 24px;       // Subsection headings
$title-large: 22px;          // Important titles
$title-medium: 16px;         // Regular titles
$title-small: 14px;          // Small titles
$body-large: 16px;           // Default body text
$body-medium: 14px;          // Secondary body text
$body-small: 12px;           // Captions, meta information
$label-large: 14px;          // Button labels
$label-medium: 12px;         // Chip labels
$label-small: 11px;          // Small labels
```

## Component Library

### React Native Paper Components

#### Button Components
```typescript
import { Button } from 'react-native-paper';

interface ButtonProps {
  mode: 'text' | 'outlined' | 'contained' | 'elevated' | 'contained-tonal';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  onPress: () => void;
  children: React.ReactNode;
}

// Usage Examples
<Button mode="contained" onPress={() => {}}>
  Primary Action
</Button>

<Button mode="outlined" onPress={() => {}}>
  Secondary Action
</Button>

<Button mode="text" onPress={() => {}}>
  Tertiary Action
</Button>
```

#### Card Components
```typescript
import { Card } from 'react-native-paper';

interface CardProps {
  mode?: 'elevated' | 'outlined' | 'contained';
  onPress?: () => void;
  children: React.ReactNode;
}

// Usage Examples
<Card mode="elevated">
  <Card.Content>
    <Text>Card content</Text>
  </Card.Content>
</Card>

<Card mode="outlined" onPress={() => {}}>
  <Card.Content>
    <Text>Clickable card</Text>
  </Card.Content>
</Card>
```

#### List Components
```typescript
import { List } from 'react-native-paper';

interface ListItemProps {
  title: string;
  description?: string;
  left?: (props: any) => React.ReactNode;
  right?: (props: any) => React.ReactNode;
  onPress?: () => void;
}

// Usage Examples
<List.Item
  title="Wallet Address"
  description="1Ab2...xyz9"
  left={props => <List.Icon {...props} icon="wallet" />}
  right={props => <List.Icon {...props} icon="chevron-right" />}
  onPress={() => {}}
/>
```

#### Chip Components
```typescript
import { Chip } from 'react-native-paper';

interface ChipProps {
  mode?: 'flat' | 'outlined';
  selected?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
}

// Usage Examples
<Chip mode="outlined" selected={selectedTimeframe === '7d'} onPress={() => setTimeframe('7d')}>
  7 Days
</Chip>
```

#### Text Input Components
```typescript
import { TextInput } from 'react-native-paper';

interface TextInputProps {
  mode?: 'flat' | 'outlined';
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address';
}

// Usage Examples
<TextInput
  mode="outlined"
  label="Search wallets"
  value={searchQuery}
  onChangeText={setSearchQuery}
  placeholder="Enter wallet address"
/>
```

## Screen Layouts

### Navigation Structure
```typescript
// Using React Navigation with Paper theming
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Provider as PaperProvider } from 'react-native-paper';

const Tab = createBottomTabNavigator();

function AppNavigator() {
  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
        <Tab.Navigator>
          <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
          <Tab.Screen name="Live Feed" component={LiveFeedScreen} />
          <Tab.Screen name="Gems" component={GemsScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}
```

### Screen Templates

#### Leaderboard Screen Layout
```typescript
import { Surface, Text, List, Chip } from 'react-native-paper';

interface LeaderboardScreenProps {
  // Screen props
}

function LeaderboardScreen() {
  return (
    <Surface style={styles.container}>
      {/* Header with filters */}
      <Surface style={styles.header}>
        <Text variant="headlineMedium">Leaderboard</Text>
        <View style={styles.filterContainer}>
          <Chip mode="outlined" selected={timeframe === '1d'} onPress={() => setTimeframe('1d')}>
            1D
          </Chip>
          <Chip mode="outlined" selected={timeframe === '7d'} onPress={() => setTimeframe('7d')}>
            7D
          </Chip>
          <Chip mode="outlined" selected={timeframe === '30d'} onPress={() => setTimeframe('30d')}>
            30D
          </Chip>
        </View>
      </Surface>

      {/* Leaderboard list */}
      <List.Section>
        {leaderboardData.map((item, index) => (
          <List.Item
            key={item.walletAddress}
            title={`#${index + 1} ${item.walletAddress}`}
            description={`PNL: ${item.pnl}`}
            left={props => <List.Icon {...props} icon="account" />}
            right={props => <Text style={styles.pnlText}>{item.pnl}</Text>}
            onPress={() => navigateToWalletDetail(item.walletAddress)}
          />
        ))}
      </List.Section>
    </Surface>
  );
}
```

## Theme Configuration

### Custom Theme Setup
```typescript
import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2196F3',
    secondary: '#4CAF50',
    tertiary: '#9C27B0',
    error: '#F44336',
    surface: '#FFFFFF',
    surfaceVariant: '#F5F5F5',
    onSurface: '#1C1C1C',
    outline: '#E0E0E0',
  },
};

const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#2196F3',
    secondary: '#4CAF50',
    tertiary: '#9C27B0',
    error: '#F44336',
    surface: '#121212',
    surfaceVariant: '#1E1E1E',
    onSurface: '#FFFFFF',
    outline: '#333333',
  },
};

// Theme provider usage
<PaperProvider theme={isDarkMode ? darkTheme : lightTheme}>
  <App />
</PaperProvider>
```

## Spacing and Layout

### Grid System
```scss
// 8dp grid system
$spacing-xs: 4px;   // 0.5 units
$spacing-sm: 8px;   // 1 unit
$spacing-md: 16px;  // 2 units
$spacing-lg: 24px;  // 3 units
$spacing-xl: 32px;  // 4 units
$spacing-xxl: 48px; // 6 units
```

### Layout Patterns
```typescript
// Common layout styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  card: {
    margin: 8,
    padding: 16,
  },
  listItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
});
```

## Accessibility

### React Native Paper Accessibility Features
```typescript
// Accessible component examples
<Button
  mode="contained"
  onPress={() => {}}
  accessibilityLabel="Refresh leaderboard data"
  accessibilityHint="Loads the latest trading data"
>
  Refresh
</Button>

<List.Item
  title="Wallet Address"
  description="1Ab2...xyz9"
  accessibilityLabel="Wallet 1Ab2...xyz9"
  accessibilityRole="button"
  accessibilityHint="Tap to view wallet details"
  onPress={() => {}}
/>
```

### Accessibility Guidelines
1. **Color Contrast**: Maintain WCAG AA contrast ratios
2. **Touch Targets**: Minimum 44px touch target size
3. **Screen Reader Support**: Proper labels and hints
4. **Focus Management**: Logical tab order and focus indicators
5. **Dynamic Type**: Support for system font size preferences

## Performance Optimization

### React Native Paper Best Practices
```typescript
// Optimized list rendering
import { FlatList } from 'react-native';
import { List } from 'react-native-paper';

function OptimizedLeaderboardList({ data }) {
  const renderItem = ({ item, index }) => (
    <List.Item
      title={item.walletAddress}
      description={`PNL: ${item.pnl}`}
      onPress={() => navigateToDetail(item.walletAddress)}
    />
  );

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={item => item.walletAddress}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={10}
      removeClippedSubviews={true}
      getItemLayout={(data, index) => ({
        length: 72,
        offset: 72 * index,
        index,
      })}
    />
  );
}
```

## Animation and Transitions

### React Native Paper Animations
```typescript
// Using Paper's built-in animations
import { useTheme } from 'react-native-paper';
import { Animated } from 'react-native';

function AnimatedCard({ children, visible }) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  return (
    <Animated.View style={[{ opacity }, styles.card]}>
      {children}
    </Animated.View>
  );
}
```

## Current Implementation Status

### Implemented Components ✅
- **Leaderboard Screen**: Fully functional with Paper components
- **Top Bar**: App header with title and navigation
- **Filter Chips**: Timeframe selection (1D, 7D, 30D)
- **List Items**: Wallet entries with formatted data
- **Theme Support**: Light theme with Material Design

### Planned Components 🔄
- **Live Feed Screen**: Real-time trades list
- **Gems Screen**: Token discovery interface
- **Wallet Detail Screen**: Comprehensive wallet analysis
- **Settings Screen**: App configuration and preferences
- **Dark Theme**: Full dark mode support
- **Advanced Animations**: Smooth transitions and loading states

## Migration Notes

### From Tamagui to React Native Paper
This documentation replaces the previous Tamagui-based design system with React Native Paper:

1. **Component Migration**: All Tamagui components replaced with Paper equivalents
2. **Theme System**: Switched to Material Design 3 theming
3. **Styling**: Moved from Tamagui's CSS-in-JS to React Native Paper's theme system
4. **Accessibility**: Enhanced accessibility with Paper's built-in features
5. **Performance**: Optimized for React Native Paper's rendering patterns

### Benefits of React Native Paper
- **Material Design**: Consistent with Android design patterns
- **Accessibility**: Built-in accessibility features
- **Theming**: Robust theme system with dark mode support
- **Performance**: Optimized for React Native
- **Maintenance**: Active development and community support 