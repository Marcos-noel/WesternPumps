# Western Pumps System Enhancements Plan

## Overview
This document outlines the implementation plan for 8 major enhancements to the Western Pumps maintenance management system.

---

## Feature 1: Store Manager Reports Section

### Description
Add a comprehensive reports module accessible to the Store Manager role.

### Reports to Include
1. **Stock Usage Reports** - Track inventory consumption over time
2. **Supplier Reports** - Performance and transaction history
3. **Most Frequently Used Stock Items** - Top consumed items
4. **Stock Usage by Technician** - Segmentation of usage by technician

### Implementation
- Create new API endpoints in `backend/app/routers/reports.py`
- Add new frontend page: `frontend/src/pages/StoreManagerReportsPage.tsx`
- Add navigation item for Store Manager role

---

## Feature 2: Report Access Control

### Description
Implement role-based permissions for report access.

### Roles
- **Admin**: Full access to all reports
- **Finance**: Access to financial and inventory reports
- **Store Manager**: Access to store-specific reports
- **Technician**: Basic reports (own jobs)
- **Manager**: General reports

### Implementation
- Update `backend/app/deps.py` with new permission checks
- Add role checks to all report endpoints
- Update frontend to show/hide reports based on user role

---

## Feature 3: Technician Job Card Image Documentation

### Description
Allow technicians to capture and upload images of completed work.

### Features
- Camera capture capability in mobile interface
- File upload functionality
- Photo types: BEFORE, AFTER, PROGRESS, DEFECT
- Viewable by Admin and Finance

### Implementation
- Use existing `JobPhoto` model (already exists!)
- Update `frontend/src/pages/JobsPage.tsx` with upload component
- Add camera capture using HTML5 MediaDevices API
- Update photo viewing permissions

---

## Feature 4: Job Card Approval Workflow

### Description
Job cards require approval before being marked "completed".

### Workflow
1. Technician marks job as "pending approval" with photos
2. Status changes to: `pending_approval`
3. Admin reviews and approves → status: `completed`
4. Admin rejects → status: `in_progress` (with feedback)

### Implementation
- Add `pending_approval` status to Job model
- Create approval API endpoints
- Add approval UI in frontend
- Add notification when approval needed

---

## Feature 5: Universal QR Code Access

### Description
QR codes for inventory items should be scannable by any QR reader.

### Features
- Generate QR codes containing item verification URL
- URL format: `https://western-pumps-np2i.vercel.app/verify/{item_id}?sku={sku}&hash={hash}`
- Public verification page showing item details
- Anti-tampering hash verification

### Implementation
- Create verification endpoint: `/api/v1/parts/{id}/verify`
- Create public verification page: `/verify/:id`
- Add QR code generation to parts list
- Add hash generation using SKU + secret key

---

## Feature 6: WhatsApp Task Notifications

### Description
Replace SMS notifications with WhatsApp messaging.

### Implementation
- Use WhatsApp Business API or Twilio WhatsApp
- Add WhatsApp configuration to settings
- Replace SMS sending in `backend/app/notifications.py`
- Store user WhatsApp numbers in profile

### Configuration Needed
```
WHATSAPP_ENABLED=true
WHATSAPP_API_URL=...
WHATSAPP_API_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
```

---

## Feature 7: Supplier Management Report

### Description
Dedicated supplier report within Stock Manager module.

### Report Contents
- Supplier contact details
- Supply history (items supplied)
- Delivery performance metrics
- Transaction records
- Quality ratings

### Implementation
- Create endpoint: `/api/v1/suppliers/{id}/report`
- Create frontend page: `/suppliers/:id/report`
- Add export to PDF/CSV

---

## Feature 8: Comprehensive Reporting System

### Description
Full reporting suite for all system users.

### Report Types
1. **Daily Work Logs** - Jobs completed per day
2. **Task Completion Statistics** - Completion rates
3. **Technician Performance** - Jobs per technician, time tracking
4. **Inventory Movement** - In/Out/Adjust transactions
5. **Financial Transactions** - Revenue, costs, profits
6. **Maintenance Schedules** - Upcoming maintenance
7. **Custom Reports** - User-defined filters

### Implementation
- Expand `backend/app/routers/reports_v2.py`
- Add report builder UI
- Add export capabilities (PDF, CSV, Excel)
- Add scheduling for automated reports

---

## Implementation Priority

| Priority | Feature | Estimated Effort |
|----------|---------|------------------|
| 1 | Job Card Image Documentation | Medium |
| 2 | Job Card Approval Workflow | Medium |
| 3 | Store Manager Reports | Medium |
| 4 | Report Access Control | Low |
| 5 | Supplier Management Report | Low |
| 6 | Universal QR Code Access | Medium |
| 7 | WhatsApp Notifications | High |
| 8 | Comprehensive Reporting | High |

---

## Database Changes Required

### New Fields
```python
# Job model - add approval fields
approved_by_user_id: Optional[int]
approved_at: Optional[datetime]
approval_notes: Optional[str]

# Part model - add QR fields
qr_secret_hash: str
```

### New Tables
- `report_schedules` - For automated reports
- `whatsapp_templates` - Message templates
- `job_approval_history` - Audit trail

---

## API Endpoints to Add

```
POST   /api/v1/jobs/{id}/submit-for-approval
POST   /api/v1/jobs/{id}/approve
POST   /api/v1/jobs/{id}/reject
GET    /api/v1/parts/{id}/verify
GET    /api/v1/parts/{id}/qrcode
GET    /api/v1/suppliers/{id}/report
GET    /api/v1/reports/stock-usage
GET    /api/v1/reports/technician-performance
POST   /api/v1/notifications/whatsapp/send
```

---

## Frontend Pages to Add/Modify

1. **JobsPage.tsx** - Add photo upload + approval workflow
2. **StoreManagerReportsPage.tsx** - New page
3. **SupplierReportPage.tsx** - New page  
4. **VerifyItemPage.tsx** - New public page
5. **ReportsPage.tsx** - Expand with more reports

---

## Migration Strategy

1. Add new database columns (backward compatible)
2. Deploy backend
3. Deploy frontend
4. Train users on new workflows
