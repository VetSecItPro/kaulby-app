import React from "react";
import { AbsoluteFill } from "remotion";
import { KaulbyLogo } from "../../shared/KaulbyLogo";
import { colors } from "../../shared/colors";

export const LogoIntro: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <KaulbyLogo showTagline showUrl startFrame={0} exitFrame={60} />
    </AbsoluteFill>
  );
};
