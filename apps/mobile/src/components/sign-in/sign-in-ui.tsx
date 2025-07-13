import { transact, isExpoGo, isMWAAvailable } from "../../utils/mobileWalletAdapter";
import { useState, useCallback } from "react";
import { Button, Text } from "react-native-paper";
import { View } from "react-native";
import { alertAndLog } from "../../utils/alertAndLog";
import { useAuthorization } from "../../utils/useAuthorization";
import { useMobileWallet } from "../../utils/useMobileWallet";

export function ConnectButton() {
  const { authorizeSession } = useAuthorization();
  const { connect } = useMobileWallet();
  const [authorizationInProgress, setAuthorizationInProgress] = useState(false);
  const handleConnectPress = useCallback(async () => {
    try {
      if (authorizationInProgress) {
        return;
      }
      setAuthorizationInProgress(true);
      await connect();
    } catch (err: any) {
      alertAndLog("Error during connect", err instanceof Error ? err.message : err);
    } finally {
      setAuthorizationInProgress(false);
    }
  }, [authorizationInProgress, authorizeSession]);
  return (
    <Button
      mode="contained"
      disabled={authorizationInProgress || !isMWAAvailable}
      onPress={handleConnectPress}
      style={{ flex: 1 }}
    >
      Connect
    </Button>
  );
}

export function SignInButton() {
  const { authorizeSession } = useAuthorization();
  const { signIn } = useMobileWallet();
  const [signInInProgress, setSignInInProgress] = useState(false);
  const handleConnectPress = useCallback(async () => {
    try {
      if (signInInProgress) {
        return;
      }
      setSignInInProgress(true);
      await signIn({
        domain: "yourdomain.com",
        statement: "Sign into Expo Template App",
        uri: "https://yourdomain.com",
      });
    } catch (err: any) {
      alertAndLog("Error during sign in", err instanceof Error ? err.message : err);
    } finally {
      setSignInInProgress(false);
    }
  }, [signInInProgress, authorizeSession]);
  return (
    <Button
      mode="outlined"
      disabled={signInInProgress || !isMWAAvailable}
      onPress={handleConnectPress}
      style={{ marginLeft: 4, flex: 1 }}
    >
      Sign in
    </Button>
  );
}

export function WalletUnavailableMessage() {
  if (isMWAAvailable) {
    return null;
  }

  return (
    <View style={{ marginTop: 16, padding: 16, backgroundColor: '#fff3cd', borderRadius: 8 }}>
      <Text style={{ color: '#856404', fontWeight: 'bold', marginBottom: 8 }}>
        📱 Wallet functionality not available
      </Text>
      <Text style={{ color: '#856404', fontSize: 12 }}>
        {isExpoGo() 
          ? "Solana Mobile Wallet Adapter requires a development build. Running in Expo Go limits wallet functionality."
          : "Mobile Wallet Adapter is not available on this device."
        }
      </Text>
      <Text style={{ color: '#856404', fontSize: 12, marginTop: 4 }}>
        To use wallet features, create a development build with: npx eas build --profile development
      </Text>
    </View>
  );
}
