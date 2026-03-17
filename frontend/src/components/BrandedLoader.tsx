import { Spin, Typography } from "antd";
import logoMark from "../assets/image.png";

type BrandedLoaderProps = {
  title?: string;
  subtitle?: string;
  compact?: boolean;
};

export default function BrandedLoader({
  title = "Welcome to Western Pumps",
  subtitle = "Preparing your workspace...",
  compact = false,
}: BrandedLoaderProps) {
  return (
    <div className={`branded-loader ${compact ? "branded-loader--compact" : ""}`}>
      <div className="branded-loader-art">
        <img src={logoMark} alt="WesternPumps logo" className="branded-loader-logo" />
        <Spin size={compact ? "small" : "large"} />
      </div>
      <Typography.Title level={compact ? 5 : 4} style={{ margin: 0 }}>
        {title}
      </Typography.Title>
      <Typography.Text type="secondary">{subtitle}</Typography.Text>
    </div>
  );
}
