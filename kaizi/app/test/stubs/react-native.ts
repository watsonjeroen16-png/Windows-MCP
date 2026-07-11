/**
 * Minimal stub for `react-native` used only so vitest (running under plain
 * Node, no Metro/babel-preset-expo) can statically import files that pull in
 * react-native purely for component/type plumbing while we unit-test their
 * exported PURE functions (see vitest.config.ts alias). React Native ships
 * Flow syntax that vitest's esbuild/rolldown-based transform can't parse, so
 * real react-native is never loaded in the test environment — this stub
 * stands in for it. Never rendered; just needs to not throw on import.
 */
function StubComponent(): null {
  return null;
}

export const View = StubComponent;
export const Text = StubComponent;
export const TextInput = StubComponent;
export const Pressable = StubComponent;
export const Modal = StubComponent;
export const FlatList = StubComponent;
export const ScrollView = StubComponent;
export const Image = StubComponent;
export const Animated = {
  View: StubComponent,
  Text: StubComponent,
  Value: class {
    setValue(): void {}
  },
  timing: () => ({ start: (cb?: () => void) => cb?.() }),
  loop: () => ({ start: () => undefined, stop: () => undefined }),
};
export const StyleSheet = {
  create: <T>(styles: T): T => styles,
  hairlineWidth: 1,
  absoluteFillObject: {},
};
export const Platform = { OS: "ios", select: (obj: Record<string, unknown>) => obj.ios };
export const Dimensions = { get: () => ({ width: 390, height: 844 }) };
export const AccessibilityInfo = {
  isReduceMotionEnabled: async () => false,
  addEventListener: () => ({ remove: () => undefined }),
};

export type TextStyle = Record<string, unknown>;
export type ViewStyle = Record<string, unknown>;
export type ImageStyle = Record<string, unknown>;
