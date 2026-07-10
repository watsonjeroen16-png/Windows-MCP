/**
 * Kaizi — onboarding app root.
 *
 * Navigation is intentionally a state-driven step switcher (no expo-router):
 * the product is 7 strictly linear onboarding screens plus two sub-screens
 * inside step 7, ending on a terminal handoff screen. A router would add
 * deep links, URL state, and a nav container that nothing here uses; the
 * OnboardingContext reducer already *is* the navigation state machine
 * (step + smsStage + direction), and back/continue are reducer actions.
 */
import {
  CormorantGaramond_300Light,
  CormorantGaramond_300Light_Italic,
  CormorantGaramond_400Regular,
  CormorantGaramond_400Regular_Italic,
} from "@expo-google-fonts/cormorant-garamond";
import { Inter_300Light, Inter_400Regular, Inter_500Medium } from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Alert, BackHandler, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { environmentById } from "./src/data/environments";
import type { EnvironmentId } from "./src/data/ids";
import { CompanionSelectionScreen } from "./src/screens/CompanionSelectionScreen";
import { EnvironmentSelectionScreen } from "./src/screens/EnvironmentSelectionScreen";
import { GoalSelectionScreen } from "./src/screens/GoalSelectionScreen";
import { HandoffScreen } from "./src/screens/HandoffScreen";
import { IdentityInputScreen } from "./src/screens/IdentityInputScreen";
import { PersonalitySelectionScreen } from "./src/screens/PersonalitySelectionScreen";
import { SmsSetupScreen } from "./src/screens/SmsSetupScreen";
import { VerifyCodeScreen } from "./src/screens/VerifyCodeScreen";
import { WelcomeScreen } from "./src/screens/WelcomeScreen";
import {
  OnboardingProvider,
  useOnboarding,
  type SmsStage,
  type Step,
} from "./src/state/OnboardingContext";
import { ground } from "./src/ui/tokens";
import { ZenBackground, type ZenVariant } from "./src/ui/ZenBackground";

interface ScreenBackground {
  variant: ZenVariant | null;
  color: string;
  skyTint?: string;
}

/** Ground + scenery per screen (spec: the Background note on each screen). */
function backgroundFor(
  step: Step,
  smsStage: SmsStage,
  environment: EnvironmentId | null,
): ScreenBackground {
  switch (step) {
    case 1:
      return { variant: "welcome", color: ground.deep };
    case 2:
    case 4:
      return { variant: "ambient", color: ground.base };
    case 3:
      return { variant: "night", color: ground.night };
    case 5:
      return { variant: null, color: ground.panel };
    case 6:
      return { variant: null, color: ground.base };
    case 7:
      if (smsStage === "handoff") {
        return {
          variant: "welcome",
          color: ground.deep,
          skyTint: environment !== null ? environmentById(environment).gradient[1] : undefined,
        };
      }
      return { variant: null, color: ground.base };
  }
}

function OnboardingFlow() {
  const { state, dispatch } = useOnboarding();
  const { step, smsStage } = state;

  // Android hardware back mirrors the back affordance; screen 1 asks before
  // exiting; the terminal handoff screen swallows back entirely.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step === 7 && smsStage === "handoff") return true;
      if (step === 1) {
        Alert.alert("Leave Kaizi?", "Your journey hasn't started yet.", [
          { text: "Stay", style: "cancel" },
          { text: "Exit", style: "destructive", onPress: () => BackHandler.exitApp() },
        ]);
        return true;
      }
      dispatch({ kind: "back" });
      return true;
    });
    return () => subscription.remove();
  }, [step, smsStage, dispatch]);

  const background = backgroundFor(step, smsStage, state.environment);

  let screen: React.ReactNode;
  switch (step) {
    case 1:
      screen = <WelcomeScreen />;
      break;
    case 2:
      screen = <GoalSelectionScreen />;
      break;
    case 3:
      screen = <IdentityInputScreen />;
      break;
    case 4:
      screen = <CompanionSelectionScreen />;
      break;
    case 5:
      screen = <PersonalitySelectionScreen />;
      break;
    case 6:
      screen = <EnvironmentSelectionScreen />;
      break;
    case 7:
      screen =
        smsStage === "phone" ? (
          <SmsSetupScreen />
        ) : smsStage === "verify" ? (
          <VerifyCodeScreen />
        ) : (
          <HandoffScreen />
        );
      break;
  }

  return (
    <View style={[styles.root, { backgroundColor: background.color }]}>
      {background.variant !== null ? (
        <ZenBackground variant={background.variant} skyTint={background.skyTint} />
      ) : null}
      {screen}
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    CormorantGaramond_300Light,
    CormorantGaramond_300Light_Italic,
    CormorantGaramond_400Regular,
    CormorantGaramond_400Regular_Italic,
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
  });

  // Hold on the ground color until the serif/sans pair is ready — a system
  // font flash would break the first impression the Welcome screen sets.
  if (!fontsLoaded) {
    return <View style={[styles.root, { backgroundColor: ground.deep }]} />;
  }

  return (
    <SafeAreaProvider>
      <OnboardingProvider>
        <StatusBar style="light" />
        <OnboardingFlow />
      </OnboardingProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
