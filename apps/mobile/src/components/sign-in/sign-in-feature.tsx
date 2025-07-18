import { View, StyleSheet } from "react-native";
import { ConnectButton, SignInButton, WalletUnavailableMessage } from "./sign-in-ui";

export function SignInFeature() {
  return (
    <>
      <View style={styles.buttonGroup}>
        <ConnectButton />
        <SignInButton />
      </View>
      <WalletUnavailableMessage />
    </>
  );
}

const styles = StyleSheet.create({
  buttonGroup: {
    marginTop: 16,
    flexDirection: "row",
  },
});
