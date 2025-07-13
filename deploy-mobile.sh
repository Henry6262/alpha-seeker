#!/bin/bash

# Alpha-Seeker Mobile App Deployment Script
# This script automates the deployment of the mobile app to Android emulator

set -e  # Exit on any error

echo "🚀 Alpha-Seeker Mobile App Deployment"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the correct directory
if [ ! -f "package.json" ] || [ ! -d "apps/mobile" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Check if required tools are installed
print_status "Checking required tools..."

if ! command -v pnpm &> /dev/null; then
    print_error "pnpm is not installed. Please install pnpm first."
    exit 1
fi

if ! command -v npx &> /dev/null; then
    print_error "npx is not installed. Please install Node.js first."
    exit 1
fi

print_success "All required tools are available"

# Step 1: Setup and install dependencies
print_status "Setting up mobile app dependencies..."
cd apps/mobile
pnpm install
print_success "Dependencies installed"

# Step 2: Fix Expo compatibility issues
print_status "Fixing Expo compatibility issues..."
npx expo install --fix
print_success "Expo compatibility fixed"

# Step 3: Clean cache if needed
print_status "Cleaning Metro bundler cache..."
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf .expo 2>/dev/null || true
print_success "Cache cleaned"

# Step 4: Check if App.tsx bridge file exists in root
cd ../..
if [ ! -f "App.tsx" ]; then
    print_warning "Creating App.tsx bridge file..."
    cat > App.tsx << 'EOF'
// This is a bridge file to resolve module resolution issues in the monorepo
// The actual App component is in apps/mobile/App.tsx
export { default } from './apps/mobile/App';
EOF
    print_success "Bridge file created"
else
    print_success "Bridge file already exists"
fi

# Step 5: Kill any existing Expo servers
print_status "Stopping any existing Expo servers..."
pkill -f "expo start" || true
print_success "Existing servers stopped"

# Step 6: Start the development server
print_status "Starting Expo development server..."
cd apps/mobile

# Start expo in background and capture PID
npx expo start --clear &
EXPO_PID=$!

# Wait for server to start
print_status "Waiting for server to start..."
sleep 5

# Check if server is running
if kill -0 $EXPO_PID 2>/dev/null; then
    print_success "Expo development server started successfully!"
    print_status "Server is running on http://localhost:8081"
    print_status "To deploy to Android emulator:"
    print_status "  1. Open Android Studio"
    print_status "  2. Start your Android emulator"
    print_status "  3. Press 'a' in the Expo CLI to launch on Android"
    print_status ""
    print_status "To stop the server, run: pkill -f 'expo start'"
    print_status ""
    print_success "Deployment completed successfully! 🎉"
else
    print_error "Failed to start Expo development server"
    exit 1
fi

# Optional: Wait for user input to test Android deployment
echo ""
read -p "Do you want to test Android deployment now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Starting Android deployment..."
    print_status "Make sure your Android emulator is running..."
    
    # Give user time to start emulator
    read -p "Press Enter when your Android emulator is ready..." -r
    
    # Try to deploy to Android
    npx expo run:android || print_warning "Android deployment failed. Make sure emulator is running."
fi

print_success "Mobile app deployment script completed!" 