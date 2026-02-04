# UI/UX Guidelines

## Layout

- Clear global navigation with consistent page titles.
- Pages prioritize the “read view” (table/list) with a secondary create/edit panel.

## Tables

- Support search, sorting, pagination where lists can grow.
- Show empty states (“No items found”) with a clear next action.
- Show critical status visually (e.g., low stock badge).
- Provide contextual row actions (e.g., edit, stock, QR code).

## Forms

- Optimize for speed: sensible defaults, simple labels, minimal required fields.
- Validate early and show actionable messages.
- Preserve context when editing (e.g., keep list filters and selection).

## Feedback states

- Loading: show a lightweight message/spinner.
- Error: show a human-readable message, keep the UI usable.
- Success: confirm the action (inline confirmation or toast).

## Accessibility baseline

- Ensure focus styles are visible.
- Don’t rely on color alone to communicate meaning.
- Keep hit targets reasonably large (buttons, row actions).
