import { Button, Empty, List, Popover, Typography } from "antd";
import { HistoryOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../state/NotificationsContext";

export default function RecentActivityBar() {
  const navigate = useNavigate();
  const { recentActivity } = useNotifications();

  const content = (
    <div className="notification-popover recent-activity-popover">
      <div className="notification-popover-head">
        <Typography.Text strong>Recent Activity</Typography.Text>
      </div>
      {recentActivity.length === 0 ? (
        <Empty description="No activity yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          size="small"
          dataSource={recentActivity}
          renderItem={(item) => (
            <List.Item
              className="notification-item"
              onClick={() => {
                navigate(item.route);
              }}
            >
              <div style={{ width: "100%" }}>
                <div className="activity-row" style={{ margin: 0, padding: "4px 0", border: "none", background: "transparent" }}>
                  <div className="activity-meta">
                    <div className="activity-title">{item.title}</div>
                    <div className="activity-sub">{item.meta}</div>
                    <div className="activity-time">{new Date(item.created_at).toLocaleString()}</div>
                  </div>
                  <div className="activity-right">
                    <span className={`activity-pill ${item.badgeClass}`}>{item.badge}</span>
                  </div>
                </div>
              </div>
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Popover trigger="click" placement="bottomRight" content={content}>
      <Button
        type="text"
        icon={<HistoryOutlined />}
        aria-label="Open recent activity"
        className="motion-icon-btn motion-icon-btn--secondary"
      />
    </Popover>
  );
}
