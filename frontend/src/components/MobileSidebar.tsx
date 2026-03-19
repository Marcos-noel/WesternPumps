import { Drawer } from "antd";
import NavBar from "./NavBar";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function MobileSidebar({ open, onClose }: Props) {
  const location = useLocation();

  useEffect(() => {
    if (!open) return;
    onClose();
    // Close the drawer after navigation so the page is usable on mobile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <>
      <Drawer
        title="Menu"
        placement="left"
        closable
        onClose={onClose}
        open={open}
        bodyStyle={{ padding: 0, overflow: "auto" }}
        width={280}
        className="mobile-sidebar-drawer"
        style={{ position: "relative", zIndex: 1001 }}
      >
        <NavBar />
      </Drawer>
    </>
  );
}

