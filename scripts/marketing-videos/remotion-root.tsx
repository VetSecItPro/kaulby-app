// Remotion entry. Registers ONE composition called "marketing" that the
// composer renders with different props per video. Keeping it generic keeps
// the bundle small — no need for one composition per video.
import { Composition, registerRoot } from "remotion";
import { MarketingVideo } from "./composition";
import type { Recipe } from "./types";
import { KAULBY_BRAND } from "./brand/kaulby";

interface MarketingProps {
  recipe: Recipe;
  capturePath: string;
}

const RootComponent = () => (
  <Composition
    id="marketing"
    component={MarketingVideo as unknown as React.FC<Record<string, unknown>>}
    fps={KAULBY_BRAND.fps}
    width={1280}
    height={720}
    // durationInFrames is set per-render via inputProps; this default supports
    // the Remotion preview studio.
    durationInFrames={KAULBY_BRAND.fps * 12}
    defaultProps={{
      recipe: {
        flowId: "preview",
        durationSec: 12,
        introSec: 0,
        outroSec: 1.5,
        captions: [],
        zooms: [],
      } as Recipe,
      capturePath: "",
    } satisfies MarketingProps}
  />
);

registerRoot(RootComponent);
