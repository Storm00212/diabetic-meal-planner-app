import React from "react";
import { View, Text } from "react-native";

/**
 * The GlucoPlate mark, drawn with plain React Native primitives so it needs
 * no icon font and no web animation library.
 */
export const Logo = ({ size = 32 }: { size?: number }) => {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: "#0d9488",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: size * 0.3,
            height: size * 0.45,
            borderTopLeftRadius: size * 0.3,
            borderTopRightRadius: size * 0.3,
            backgroundColor: "#0d9488",
          }}
        />
      </View>
      <Text style={{ fontSize: size * 0.62, fontWeight: "700", color: "#0f172a" }}>
        Gluco<Text style={{ color: "#0d9488" }}>Plate</Text>
      </Text>
    </View>
  );
};
