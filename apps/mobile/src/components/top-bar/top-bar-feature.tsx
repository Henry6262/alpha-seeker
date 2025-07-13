import { StyleSheet } from "react-native";
import { Appbar, useTheme } from "react-native-paper";
import { TopBarWalletButton, TopBarWalletMenu } from "./top-bar-ui";
import { useNavigation } from "@react-navigation/core";

export function TopBar() {
  const navigation = useNavigation();
  const theme = useTheme();

  return (
    <Appbar.Header mode="small" style={styles.topBar}>
      <Appbar.Content 
        title="Alpha Seeker" 
        subtitle="Solana Trading Intelligence"
        titleStyle={styles.title}
        subtitleStyle={styles.subtitle}
      />
      
      <TopBarWalletMenu />

      <Appbar.Action
        icon="cog"
        mode="contained-tonal"
        onPress={() => {
          navigation.navigate("Settings");
        }}
      />
    </Appbar.Header>
  );
}

const styles = StyleSheet.create({
  topBar: {
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196f3',
  },
  subtitle: {
    fontSize: 12,
    opacity: 0.7,
  },
});
