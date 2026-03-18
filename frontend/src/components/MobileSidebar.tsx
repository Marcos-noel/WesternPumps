import { Drawer } from "antd";
import { MenuFoldOutlined } from "@ant-design/icons";
import NavBar from "./NavBar";
import { useLocation } from "react-router-dom";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function MobileSidebar({ open, onClose }: Props) {
  const location = useLocation();

  return (
    <>
      <Drawer
        title={null}
        placement="left"
        closable={false}
        onClose={onClose}
        open={open}
        bodyStyle={{ padding: 0 }}
        width={Math.min(280, window.innerWidth * 0.75)}
        className="mobile-sidebar-drawer"
        style={{ position: "relative", zIndex: 1001 }}
      >
        <NavBar />
      </Drawer>
      {open && (
        <div className="mobile-sidebar-overlay" onClick={onClose} />
      )}
    </>
  );
}

