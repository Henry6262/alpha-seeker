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

## Color Palette

### Primary Colors
```scss
$primary-green: #00FFA3;      // Success, positive PNL, gains
$primary-blue: #3B82F6;       // Primary actions, links, navigation
$primary-purple: #8B5CF6;     // Premium features, subscriptions
```

### Secondary Colors
```scss
$secondary-red: #EF4444;      // Losses, negative PNL, warnings
$secondary-yellow: #F59E0B;   // Neutral, pending states
$secondary-gray: #6B7280;     // Secondary text, borders
```

### Neutral Colors
```scss
$background-dark: #0F0F0F;    // Main background (dark theme)
$background-light: #FFFFFF;   // Main background (light theme)
$surface-dark: #1F1F1F;       // Card backgrounds (dark)
$surface-light: #F8FAFC;      // Card backgrounds (light)
$text-primary: #FFFFFF;       // Primary text (dark theme)
$text-secondary: #9CA3AF;     // Secondary text
$border: #374151;             // Borders and dividers
```

### Gradient System
```scss
$gradient-primary: linear-gradient(135deg, $primary-blue, $primary-purple);
$gradient-success: linear-gradient(135deg, $primary-green, #10B981);
$gradient-warning: linear-gradient(135deg, $secondary-yellow, #F97316);
$gradient-danger: linear-gradient(135deg, $secondary-red, #DC2626);
```

## Typography

### Font Families
- **Primary**: Inter (Modern, highly legible, excellent for data)
- **Monospace**: JetBrains Mono (Code, addresses, numbers)
- **Display**: Inter Display (Headers, emphasis)

### Font Scale
```scss
$font-xs: 12px;      // Captions, meta information
$font-sm: 14px;      // Body text, secondary information
$font-base: 16px;    // Default body text
$font-lg: 18px;      // Emphasized text
$font-xl: 20px;      // Small headings
$font-2xl: 24px;     // Section headings
$font-3xl: 32px;     // Page titles
$font-4xl: 40px;     // Hero text, key metrics
```

### Font Weights
- **Light**: 300 (Large numbers, display text)
- **Regular**: 400 (Body text)
- **Medium**: 500 (Emphasized text)
- **Semibold**: 600 (Headings, important data)
- **Bold**: 700 (Key metrics, alerts)

## Spacing System

### Base Unit: 4px
```scss
$space-1: 4px;       // Micro spacing
$space-2: 8px;       // Small spacing
$space-3: 12px;      // Default spacing
$space-4: 16px;      // Medium spacing
$space-5: 20px;      // Large spacing
$space-6: 24px;      // XL spacing
$space-8: 32px;      // XXL spacing
$space-10: 40px;     // Section spacing
$space-12: 48px;     // Large sections
$space-16: 64px;     // Page sections
```

## Component Library

### Button Components

#### Primary Button
```typescript
interface PrimaryButtonProps {
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  state: 'default' | 'loading' | 'disabled';
  fullWidth?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}
```

**Specifications:**
- Height: sm(32px), md(40px), lg(48px)
- Padding: sm(12px), md(16px), lg(20px)
- Border radius: 8px
- Font weight: Medium (500)
- Transition: 150ms ease-in-out

#### Button States
- **Default**: Full opacity, normal colors
- **Hover**: 90% opacity, subtle scale (1.02)
- **Active**: 85% opacity, scale (0.98)
- **Loading**: Spinner animation, disabled interaction
- **Disabled**: 50% opacity, no interaction

### Card Components

#### Data Card
```typescript
interface DataCardProps {
  variant: 'default' | 'highlighted' | 'compact';
  elevation: 'none' | 'sm' | 'md' | 'lg';
  padding: 'sm' | 'md' | 'lg';
  header?: ReactNode;
  footer?: ReactNode;
  interactive?: boolean;
}
```

**Specifications:**
- Background: Surface color with gradient overlay for highlighted
- Border: 1px solid border color
- Border radius: 12px
- Shadow: Elevation-based (0, 2, 4, 8px blur)
- Padding: sm(12px), md(16px), lg(24px)

### List Components

#### Leaderboard Item
```typescript
interface LeaderboardItemProps {
  rank: number;
  walletAddress: string;
  displayName?: string;
  metric: string;
  change?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
  };
  avatar?: string;
  highlighted?: boolean;
}
```

#### Trade Item
```typescript
interface TradeItemProps {
  timestamp: Date;
  walletAddress: string;
  action: 'buy' | 'sell';
  tokenSymbol: string;
  amount: string;
  value: string;
  status: 'confirmed' | 'pending' | 'failed';
}
```

### Input Components

#### Search Input
```typescript
interface SearchInputProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  icon?: ReactNode;
  clearable?: boolean;
  loading?: boolean;
}
```

#### Filter Toggle
```typescript
interface FilterToggleProps {
  options: Array<{
    value: string;
    label: string;
    count?: number;
  }>;
  value: string;
  onChange: (value: string) => void;
  variant: 'tabs' | 'pills' | 'dropdown';
}
```

### Modal Components

#### Subscription Modal
```typescript
interface SubscriptionModalProps {
  tier: 'free' | 'degen' | 'market-maker';
  currentTier?: string;
  features: string[];
  price: string;
  onSubscribe: () => void;
  onCancel: () => void;
}
```

#### Token Details Modal
```typescript
interface TokenDetailsModalProps {
  token: {
    symbol: string;
    name: string;
    address: string;
    price: string;
    marketCap: string;
    volume24h: string;
    holders: Array<{
      address: string;
      percentage: number;
    }>;
  };
  onClose: () => void;
}
```

## Screen Layouts

### Tab Navigation Structure
```
┌─────────────────────────────────┐
│           Header Bar            │ 60px
├─────────────────────────────────┤
│                                 │
│         Content Area            │ flex-1
│                                 │
├─────────────────────────────────┤
│          Tab Bar               │ 80px
└─────────────────────────────────┘
```

### Header Bar Components
- **Left**: Back button / Menu icon
- **Center**: Screen title / Search bar
- **Right**: Notifications / Settings / Wallet status

### Tab Bar Icons
- **Leaderboards**: Trophy icon
- **Live Feed**: Activity/Pulse icon
- **Gems**: Diamond icon
- **Profile**: User icon

## User Flow Diagrams

### Onboarding Flow
```
App Launch → Wallet Connect → Permission Setup → Tutorial → Main App
    ↓              ↓             ↓              ↓          ↓
  Splash      Choose Wallet   Notifications   Features   Dashboard
   Page       Connection      Request         Overview    
```

### Subscription Flow
```
Profile Tab → Subscription → Choose Plan → Payment → Confirmation
     ↓            ↓            ↓           ↓          ↓
   Settings    Current Tier   Plan Details  Solana Pay  Success
   Screen      Display        Comparison    QR Code     Screen
```

### Notification Setup Flow
```
Profile → Settings → Notifications → Choose Wallet → Set Filters → Activate
   ↓        ↓           ↓              ↓             ↓           ↓
Settings  Notification Wallet List   Filter Setup  Confirmation Success
Screen    Preferences  Selection     SOL Amount    Screen      Screen
                                    Market Cap
```

## Screen-Specific UI Requirements

### Leaderboards Screen

#### Layout Structure
```
┌─────────────────────────────────┐
│ Time Filter [1h][1d][7d][30d]   │ 
│ Token Filter [All][Pump][Bonk]  │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ Rank | Wallet | PNL | Δ    │ │
│ │   1  | 1Ab2... | +45 | ↑2  │ │
│ │   2  | 3Cd4... | +32 | ↓1  │ │
│ │   3  | 5Ef6... | +28 | ↑1  │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

#### Interactive Elements
- **Time Filter**: Segmented control with active state
- **Token Filter**: Chip-based filter with counts
- **Leaderboard Items**: Swipeable for quick actions
- **Pull to Refresh**: Standard iOS/Android pattern
- **Infinite Scroll**: Load more on scroll

### Live Feed Screen

#### Layout Structure
```
┌─────────────────────────────────┐
│ 🔴 LIVE | Last update: 2s ago   │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ [💰] Buy BONK              │ │
│ │ 1Ab2... | 15.5 SOL | 2s ago│ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ [📈] Sell PUMP             │ │
│ │ 3Cd4... | 23.1 SOL | 5s ago│ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

#### Real-Time Features
- **Live Indicator**: Pulsing red dot when connected
- **Auto-scroll**: New trades appear at top
- **Sound Notifications**: Optional audio alerts
- **Haptic Feedback**: For new trade notifications

### Gems Screen

#### Layout Structure
```
┌─────────────────────────────────┐
│ Holdings > 0.01 SOL             │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ [🔥] TOKEN_NAME             │ │
│ │ $0.001 | MC: $2.3M         │ │
│ │ 👥 3 top traders holding    │ │
│ │ 📊 Total: 45.2 SOL         │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

#### Discovery Features
- **Token Cards**: Expandable for more details
- **Social Proof**: Top trader avatars/names
- **Quick Actions**: Add to watchlist, view details
- **Sorting Options**: By holdings, trader count, recency

### Profile Screen

#### Layout Structure
```
┌─────────────────────────────────┐
│ ┌─────┐ Wallet: 1Ab2...         │
│ │ 👤  │ Tier: Degen             │
│ └─────┘ Notifications: 3 active │
├─────────────────────────────────┤
│ Trading Performance (30d)       │
│ ┌─────────────────────────────┐ │
│ │ TOKEN | PNL | ROI | Duration│ │
│ │ BONK  |+103 |187% | 1d     │ │
│ │ PUMP  | -12 |-23% | 3h     │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ [Manage Subscription]           │
│ [Notification Settings]         │
│ [Export Data]                   │
└─────────────────────────────────┘
```

## Mobile-First Design Considerations

### Touch Targets
- **Minimum Size**: 44px x 44px (iOS) / 48dp x 48dp (Android)
- **Spacing**: 8px minimum between touch targets
- **Gesture Support**: Swipe, pinch, long-press where appropriate

### Responsive Breakpoints
```scss
$mobile-sm: 320px;   // iPhone SE
$mobile-md: 375px;   // iPhone standard
$mobile-lg: 414px;   // iPhone Plus
$tablet-sm: 768px;   // iPad mini
$tablet-lg: 1024px;  // iPad Pro
```

### Platform-Specific Considerations

#### iOS Design Elements
- **Navigation**: iOS-style navigation with large titles
- **Tab Bar**: Bottom tab bar with SF Symbols
- **Modals**: Sheet-style presentations
- **Lists**: iOS-style disclosure indicators
- **Pull-to-Refresh**: iOS bouncy animation

#### Android Design Elements
- **Navigation**: Material Design navigation patterns
- **Tab Bar**: Material Design bottom navigation
- **Modals**: Full-screen or bottom sheet modals
- **Lists**: Material ripple effects
- **Pull-to-Refresh**: Material circular progress

### Performance Optimizations
- **Image Loading**: Progressive loading with placeholders
- **List Virtualization**: Only render visible items
- **Bundle Splitting**: Code splitting for faster initial load
- **Caching Strategy**: Aggressive caching for frequently accessed data

## Accessibility Standards

### Color Accessibility
- **Contrast Ratio**: Minimum 4.5:1 for normal text, 3:1 for large text
- **Color Independence**: Information not conveyed by color alone
- **Dark Mode**: Full support with appropriate contrast adjustments

### Typography Accessibility
- **Font Size**: Minimum 16px for body text
- **Line Height**: 1.5x font size for readability
- **Font Weight**: Sufficient contrast between weights
- **Dynamic Type**: Support for user font size preferences

### Interaction Accessibility
- **Screen Reader**: Full VoiceOver/TalkBack support
- **Keyboard Navigation**: Tab order and focus management
- **Voice Control**: Voice command support where applicable
- **Reduced Motion**: Respect user motion preferences

### Content Accessibility
- **Alt Text**: Descriptive alt text for all images
- **Labels**: Clear, descriptive labels for all interactive elements
- **Error Messages**: Clear, actionable error descriptions
- **Loading States**: Accessible loading and progress indicators

## Animation and Micro-Interactions

### Transition Timing
```scss
$transition-fast: 150ms ease-in-out;
$transition-base: 200ms ease-in-out;
$transition-slow: 300ms ease-in-out;
$transition-bounce: 400ms cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

### Animation Patterns
- **Page Transitions**: Slide, fade, or scale based on context
- **Data Updates**: Subtle highlights for new information
- **Loading States**: Skeleton screens and progress indicators
- **Success States**: Checkmark animations and subtle celebrations
- **Error States**: Shake animations and clear visual feedback

### Micro-Interactions
- **Button Press**: Scale down (0.95) with haptic feedback
- **Card Selection**: Subtle elevation and border highlight
- **Number Changes**: Count-up animations for metrics
- **Connection Status**: Pulse animation for live indicators
- **Refresh Actions**: Satisfying pull-to-refresh with feedback

## Data Visualization Guidelines

### Chart Types
- **Line Charts**: Price movements, performance over time
- **Bar Charts**: Volume comparisons, leaderboard rankings
- **Pie Charts**: Portfolio composition, holdings breakdown
- **Sparklines**: Inline trend indicators

### Color Coding
- **Green**: Positive values, gains, upward trends
- **Red**: Negative values, losses, downward trends
- **Blue**: Neutral values, informational data
- **Yellow**: Warning states, pending transactions

### Number Formatting
- **Currency**: $1,234.56 (USD), 12.34 SOL (crypto)
- **Percentages**: +15.3%, -8.2% (with appropriate colors)
- **Large Numbers**: 1.2M, 3.4B (abbreviated for space)
- **Addresses**: Truncated with copy functionality (1Ab2...cD3e)

### Real-Time Data Indicators
- **Live Badge**: Pulsing green indicator for real-time feeds
- **Last Updated**: Relative timestamps (2s ago, 1m ago)
- **Connection Status**: Clear indicators for WebSocket status
- **Data Freshness**: Visual indicators for stale data

This comprehensive UI/UX documentation ensures a consistent, accessible, and engaging user experience across the alpha-seeker mobile application, with particular attention to the unique needs of crypto traders and mobile-first usage patterns. 