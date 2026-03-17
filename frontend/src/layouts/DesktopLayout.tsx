import { Layout } from "antd";
import type { ReactNode } from "react";

const { Header, Content } = Layout;

type Props = {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
};

export default function DesktopLayout({ sidebar, header, children }: Props) {
  return (
    <Layout className="desktop-layout" style={{ minHeight: "100vh" }}>
      {sidebar}
      <Layout>
        <Header className="app-header">{header}</Header>
        <Content className="app-content">
          <div className="content-shell">{children}</div>
        </Content>
      </Layout>
    </Layout>
  );
}
