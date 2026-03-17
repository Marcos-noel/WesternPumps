import { Layout } from "antd";
import type { ReactNode } from "react";
import MobileBottomNav from "../components/MobileBottomNav";

const { Header, Content } = Layout;

type Props = {
  header: ReactNode;
  children: ReactNode;
  canViewInventory: boolean;
};

export default function MobileLayout({ header, children, canViewInventory }: Props) {
  return (
    <Layout className="mobile-layout" style={{ minHeight: "100dvh" }}>
      <Header className="app-header">{header}</Header>
      <Content className="mobile-layout-content">
        <div className="content-shell route-transition-wrapper">{children}</div>
      </Content>
      <MobileBottomNav canViewInventory={canViewInventory} />
    </Layout>
  );
}

