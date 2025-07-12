import React from "react";
import { ClusterNetwork, useCluster } from "./cluster-data-access";
import { RadioButton, Text } from "react-native-paper";
import { ClusterPickerRadioButtonGroupRow } from "./cluster-ui";

function clusternetworkToIndex(clusterName: string): number {
  switch (clusterName) {
    case ClusterNetwork.Devnet:
      return 0;
    case ClusterNetwork.Testnet:
      return 1;
    default:
      throw Error("Invalid cluster selected");
  }
}

export function ClusterPickerFeature() {
  const { selectedCluster, clusters, setSelectedCluster } = useCluster();
  const [devNetCluster, testNetCluster] = clusters;

  if (!devNetCluster || !testNetCluster) {
    return <Text>Loading clusters...</Text>;
  }

  return (
    <>
      <Text variant="headlineMedium">Cluster:</Text>
      <RadioButton.Group
        onValueChange={newClusternetwork => {
          const clusterIndex = clusternetworkToIndex(newClusternetwork);
          const selectedCluster = clusters[clusterIndex];
          if (selectedCluster) {
            setSelectedCluster(selectedCluster);
          }
        }}
        value={selectedCluster.network}
      >
        <ClusterPickerRadioButtonGroupRow cluster={devNetCluster} />
        <ClusterPickerRadioButtonGroupRow cluster={testNetCluster} />
      </RadioButton.Group>
    </>
  );
}
