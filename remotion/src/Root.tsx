import React from "react";
import { Composition } from "remotion";
import { AIChatDemo } from "./ai-chat-demo/AIChatDemo";
import { PainPointDemo } from "./pain-point-demo/PainPointDemo";
import { CompetitorDemo } from "./competitor-demo/CompetitorDemo";
import { ProductOverview } from "./product-overview/ProductOverview";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AIChatDemo"
        component={AIChatDemo}
        durationInFrames={540}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="PainPointDemo"
        component={PainPointDemo}
        durationInFrames={750}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="CompetitorDemo"
        component={CompetitorDemo}
        durationInFrames={750}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="ProductOverview"
        component={ProductOverview}
        durationInFrames={900}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
