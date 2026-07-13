/** Cormorant Garamond wrapper — serif carries meaning (tokens.md section 2). */
import React from "react";
import { Text, TextStyle } from "react-native";

import { font, type } from "./tokens";

type SerifSize = "wordmark" | "display" | "title" | "heading";

interface SerifTitleProps {
  size?: SerifSize;
  italic?: boolean;
  style?: TextStyle | TextStyle[];
  children: React.ReactNode;
}

const SIZE_STYLES: Record<SerifSize, TextStyle> = {
  wordmark: type.wordmark,
  display: type.display,
  title: type.title,
  heading: type.heading,
};

export function SerifTitle({ size = "title", italic = false, style, children }: SerifTitleProps) {
  return (
    <Text
      style={[SIZE_STYLES[size], italic ? { fontFamily: font.serifLightItalic } : null, style]}
    >
      {children}
    </Text>
  );
}
