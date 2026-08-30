import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import HomeScreen from "./src/screens/HomeScreen";
import ScanScreen from "./src/screens/ScanScreen";
import { usePet } from "./src/state/usePet";
import { colors } from "./src/theme";

export default function App() {
  const { pet, loading, createPet, act, setFace } = usePet();
  const [rescanning, setRescanning] = useState(false);

  let content: React.ReactNode;
  if (loading) {
    content = (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  } else if (!pet || !pet.faceUri) {
    content = <ScanScreen onDone={(faceUri, name) => createPet(name, faceUri)} />;
  } else if (rescanning) {
    content = (
      <ScanScreen
        existingName={pet.name}
        onDone={(faceUri) => {
          setFace(faceUri);
          setRescanning(false);
        }}
      />
    );
  } else {
    content = <HomeScreen pet={pet} onAction={act} onRescan={() => setRescanning(true)} />;
  }

  return (
    <SafeAreaProvider>
      {content}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
});
