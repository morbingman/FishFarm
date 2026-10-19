# UI components

Các primitive trong `src/components/ui/` lấy từ registry chính thức shadcn/ui (new-york; NativeSelect từ new-york-v4), sau đó tách style sang CSS và tùy chỉnh để phù hợp giao diện hiện tại.

- https://ui.shadcn.com/docs/components
- https://github.com/shadcn-ui/ui

Các component dùng thật: Button, Input, Textarea, Label, Table, NativeSelect, Dialog, Popover, DropdownMenu. Không cài những component chưa sử dụng.

Button có thêm variant `plain` để ghép với class thiết kế sẵn. Input giữ giao diện native cho checkbox/radio/range/file. Dialog và menu dùng Radix thông qua shadcn để quản lý focus, Escape và hành vi mở/đóng. Các component nghiệp vụ ghép từ primitive này.
