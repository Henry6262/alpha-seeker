# Alpha-Seeker Mobile App Deployment Guide

## Quick Start (Recommended)

### Option 1: One-Command Deployment
```bash
# From project root
./deploy-mobile.sh
```

### Option 2: Package Scripts
```bash
# Setup (run once or when dependencies change)
npm run mobile:setup

# Start development server
npm run mobile:start

# Build for Android
npm run mobile:build

# Deploy to Android emulator
npm run mobile:android
```

## Manual Deployment Process

### Step 1: Environment Setup
```bash
cd apps/mobile
pnpm install
```

### Step 2: Fix Dependencies
```bash
npx expo install --fix
```

### Step 3: Clear Cache (if needed)
```bash
rm -rf node_modules/.cache
rm -rf .expo
```

### Step 4: Start Development Server
```bash
npx expo start --clear
```

### Step 5: Deploy to Android
1. Open Android Studio
2. Start Android emulator
3. In the Expo CLI, press 'a' to deploy to Android

## Architecture Overview

### Monorepo Structure
```
solana-mobile-expo-template-main/
├── App.tsx                    # Bridge file (DO NOT DELETE)
├── deploy-mobile.sh          # Automated deployment script
├── apps/
│   └── mobile/
│       ├── App.tsx           # Actual mobile app
│       ├── metro.config.js   # Metro bundler config
│       └── package.json      # Mobile app dependencies
└── package.json              # Root package with deployment scripts
```

### Key Files

1. **Root/App.tsx** - Bridge file that resolves module paths
2. **apps/mobile/metro.config.js** - Metro bundler configuration for monorepo
3. **apps/mobile/App.tsx** - Main mobile application component

## Common Issues & Solutions

### Module Resolution Error (HTTP 500)
**Error**: `Unable to resolve module ../../App from expo/AppEntry.js`

**Solution**: This is automatically handled by the bridge file. Ensure:
- Root `App.tsx` exists and contains the bridge export
- Metro config is properly configured for monorepo
- Cache is cleared

### Port Conflicts
**Error**: `Port 8081 is running this app in another window`

**Solution**: 
```bash
pkill -f "expo start"
# Or use a different port
npx expo start --port 8082
```

### Metro Cache Issues
**Error**: Outdated bundles, build failures

**Solution**: 
```bash
npx expo start --clear
# Or manually clear cache
rm -rf node_modules/.cache && rm -rf .expo
```

### Dependency Conflicts
**Error**: Peer dependency warnings

**Solution**: 
```bash
npx expo install --fix
```

### Solana Mobile Wallet Adapter Not Available
**Error**: `SolanaMobileWalletAdapter could not be found`

**Solution**: This is expected in Expo Go. The app now handles this gracefully:
- Wallet buttons are disabled when the native module is not available
- A warning message explains the limitation
- Full functionality requires a development build

**For full wallet functionality**:
```bash
npx eas build --profile development --platform android
```

## Development Workflow

### For New Developers
1. Clone the repository
2. Run `./deploy-mobile.sh` from project root
3. Follow the prompts to deploy to Android

### For Existing Developers
1. Pull latest changes
2. Run `npm run mobile:setup` if dependencies changed
3. Run `npm run mobile:start` to start development

### Before Committing
1. Test build: `npm run mobile:build`
2. Verify Android deployment works
3. Check that all caches are cleared

## Troubleshooting

### Build Fails
1. Check that you're in the correct directory
2. Ensure bridge file exists: `ls App.tsx`
3. Clear all caches: `npm run mobile:clean`
4. Restart from setup: `npm run mobile:setup`

### Android Emulator Issues
1. Ensure Android Studio is installed
2. Create and start an Android Virtual Device (AVD)
3. Verify emulator is running before deploying

### Server Won't Start
1. Check if port 8081 is available
2. Kill existing processes: `pkill -f "expo start"`
3. Try a different port: `npx expo start --port 8082`

## Production Deployment

### EAS Build
```bash
cd apps/mobile
npx eas build --platform android
```

### Local Build
```bash
cd apps/mobile
npx eas build --platform android --local
```

## Environment Variables

The app uses environment variables for configuration:
- `DUNE_API_KEY` - For Dune Analytics integration
- Other environment variables are loaded from `.env.local`

## Performance Tips

1. **Always clear cache** when switching between branches
2. **Use --clear flag** when starting the development server
3. **Kill background processes** before starting new ones
4. **Keep Android emulator running** for faster deployment

## Support

If you encounter issues:
1. Check `Docs/Bug_tracking.md` for known issues
2. Review this deployment guide
3. Clear all caches and try again
4. Check the project structure documentation

## Quick Reference

| Command | Purpose |
|---------|---------|
| `./deploy-mobile.sh` | Complete automated deployment |
| `npm run mobile:setup` | Install dependencies and fix compatibility |
| `npm run mobile:start` | Start development server |
| `npm run mobile:clean` | Clear all caches |
| `npm run mobile:android` | Deploy to Android emulator |
| `pkill -f "expo start"` | Stop all Expo servers |
| `npx expo start --clear` | Start with cleared cache |

---

**Note**: This deployment guide is specifically designed for the Alpha-Seeker monorepo structure. Always run commands from the specified directories and ensure the bridge file remains in place. 