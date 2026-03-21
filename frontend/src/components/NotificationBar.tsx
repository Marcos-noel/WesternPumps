import { Badge, Button, Empty, List, Popover, Typography } from "antd";
import { BellOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../state/NotificationsContext";

export default function NotificationBar() {
  const navigate = useNavigate();
  const { unreadCount, notifications, markAllRead } = useNotifications();

  const content = (
    <div className="notification-popover">
      <div className="notification-popover-head">
        <Typography.Text strong>Notifications</Typography.Text>
        <Button
          type="link"
          size="small"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            markAllRead();
          }}
        >
          Mark read
        </Button>
      </div>
      {notifications.length === 0 ? (
        <Empty description="No pending requests" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          size="small"
          dataSource={notifications}
          renderItem={(n) => (
            <List.Item
              className="notification-item"
              onClick={() => {
                markAllRead();
                navigate(n.route);
              }}
            >
              <div>
                <Typography.Text strong>{n.title}</Typography.Text>
                <div className="notification-sub">{n.description}</div>
                <div className="notification-time">{new Date(n.created_at).toLocaleString()}</div>
              </div>
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Popover 
      trigger="click" 
      placement="bottomRight" 
      content={content}
      overlayClassName="mobile-notification-popover"
    >
      <Badge count={unreadCount} size="small">
        <Button
          type="text"
          icon={<BellOutlined />}
          aria-label="Open notifications"
          className={`motion-icon-btn ${unreadCount > 0 ? "motion-icon-btn--active" : ""}`}
        />
      </Badge>
    </Popover>
  );
}
