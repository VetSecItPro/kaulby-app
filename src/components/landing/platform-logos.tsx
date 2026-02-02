/**
 * Platform logos for landing page mock components.
 * Uses @icons-pack/react-simple-icons for crisp brand SVGs.
 * Amazon uses a hand-crafted SVG since it's not in Simple Icons.
 */
import {
  SiReddit,
  SiYcombinator,
  SiProducthunt,
  SiGoogle,
  SiTrustpilot,
  SiYoutube,
  SiGithub,
  SiIndiehackers,
  SiDevdotto,
  SiHashnode,
  SiQuora,
  SiAppstore,
  SiGoogleplay,
  SiG2,
  SiYelp,
} from "@icons-pack/react-simple-icons";

function AmazonLogo({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path d="M.045 18.02c.072-.116.187-.124.348-.024 3.381 2.209 7.03 3.315 10.946 3.315 2.906 0 5.726-.69 8.46-2.068.213-.1.39-.148.53-.148.2 0 .33.1.394.3.065.2-.01.4-.218.6C17.705 22.217 14.418 23 11.033 23c-4.062 0-7.62-1.2-10.676-3.588-.178-.136-.258-.3-.312-.392zm20.52-2.73c-.202-.26-.508-.39-.92-.39-.2 0-.468.03-.8.09-.332.06-.7.19-1.098.39-.346.17-.52.36-.52.56 0 .12.06.2.184.24.122.04.3.01.534-.1.836-.39 1.462-.59 1.878-.59.37 0 .554.18.554.54 0 .26-.094.6-.28 1.03-.186.43-.28.71-.28.84 0 .12.04.2.116.24.076.04.164.01.264-.08.4-.36.717-.9.95-1.62.234-.72.35-1.25.35-1.6 0-.18-.044-.32-.132-.42z" />
      <path d="M12.258 14.77c-1.444 0-2.626-.375-3.544-1.126-.918-.75-1.378-1.84-1.378-3.27 0-1.52.544-2.71 1.63-3.57 1.088-.86 2.49-1.29 4.206-1.29.526 0 1.11.06 1.752.18V5.2c0-.82-.158-1.39-.474-1.71-.316-.32-.852-.48-1.608-.48-.53 0-1.05.07-1.558.21-.508.14-.898.29-1.17.45-.212.12-.374.18-.486.18-.156 0-.234-.1-.234-.3v-.62c0-.18.03-.32.09-.42.06-.1.18-.2.36-.3.472-.28 1.07-.52 1.794-.7.724-.18 1.43-.27 2.118-.27 1.372 0 2.384.31 3.036.94.652.63.978 1.59.978 2.89v7.57h-.948c-.12 0-.224-.02-.31-.06-.086-.04-.156-.13-.21-.27l-.21-.8c-.374.36-.784.66-1.23.9-.446.24-.958.36-1.536.36zm.576-1.38c.44 0 .86-.1 1.26-.3.4-.2.74-.48 1.02-.84V10c-.41-.1-.87-.15-1.38-.15-.82 0-1.46.19-1.92.57-.46.38-.69.88-.69 1.5 0 .52.13.9.39 1.14.26.24.66.36 1.2.36l.12-.03z" />
    </svg>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LogoEntry = { component: React.ComponentType<any> };

const logoMap: Record<string, LogoEntry> = {
  reddit: { component: SiReddit },
  hackernews: { component: SiYcombinator },
  producthunt: { component: SiProducthunt },
  googlereviews: { component: SiGoogle },
  trustpilot: { component: SiTrustpilot },
  youtube: { component: SiYoutube },
  github: { component: SiGithub },
  indiehackers: { component: SiIndiehackers },
  devto: { component: SiDevdotto },
  hashnode: { component: SiHashnode },
  quora: { component: SiQuora },
  appstore: { component: SiAppstore },
  playstore: { component: SiGoogleplay },
  g2: { component: SiG2 },
  yelp: { component: SiYelp },
  amazon: { component: AmazonLogo },
};

export function PlatformLogo({
  platform,
  className = "h-3.5 w-3.5",
  size,
}: {
  platform: string;
  className?: string;
  size?: number;
}) {
  const entry = logoMap[platform];
  if (!entry) return null;
  const Logo = entry.component;
  return <Logo size={size} className={className} color="currentColor" />;
}
