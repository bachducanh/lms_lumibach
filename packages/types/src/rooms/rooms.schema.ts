import { z } from 'zod';

// ── Nhãn hiển thị ──────────────────────────────────────────────
// Dự án không có lớp i18n; quy ước hiện hành là gom nhãn tiếng Việt vào
// packages/types để FE và BE dùng chung một nguồn (xem GROUP_MODES).

export const ROOM_BOOKING_STATUSES = [
  { value: 'PENDING', label: 'Chờ duyệt', tone: 'warning' },
  { value: 'APPROVED', label: 'Đã duyệt', tone: 'info' },
  { value: 'CHECKED_IN', label: 'Đang sử dụng', tone: 'active' },
  { value: 'CHECKED_OUT', label: 'Đã trả, chờ xác nhận', tone: 'info' },
  { value: 'COMPLETED', label: 'Hoàn tất', tone: 'success' },
  { value: 'REJECTED', label: 'Bị từ chối', tone: 'danger' },
  { value: 'CANCELLED', label: 'Đã huỷ', tone: 'muted' },
  { value: 'NO_SHOW', label: 'Không đến nhận', tone: 'danger' },
] as const;

export type RoomBookingStatusValue = (typeof ROOM_BOOKING_STATUSES)[number]['value'];

export const ROOM_BOOKING_STATUS_LABEL: Record<RoomBookingStatusValue, string> = Object.fromEntries(
  ROOM_BOOKING_STATUSES.map((s) => [s.value, s.label])
) as Record<RoomBookingStatusValue, string>;

/** Các trạng thái còn giữ chỗ trên lịch — khớp mệnh đề WHERE của ràng buộc
 *  EXCLUDE trong migration. Đổi ở đây thì PHẢI đổi cả ràng buộc CSDL. */
export const BLOCKING_BOOKING_STATUSES = ['PENDING', 'APPROVED', 'CHECKED_IN'] as const;

export const HANDOVER_FIELD_TYPES = [
  { value: 'NUMBER', label: 'Số' },
  { value: 'TEXT', label: 'Văn bản' },
  { value: 'SELECT', label: 'Chọn từ danh sách' },
  { value: 'BOOLEAN', label: 'Có / Không' },
] as const;

export const HANDOVER_FIELD_APPLIES = [
  { value: 'CHECKIN', label: 'Chỉ khi nhận' },
  { value: 'CHECKOUT', label: 'Chỉ khi trả' },
  { value: 'BOTH', label: 'Cả hai lượt' },
] as const;

// ── Zod schemas ────────────────────────────────────────────────

/** Mã phòng dùng làm URL: chỉ chữ thường, số và gạch ngang. */
export const RoomCodeSchema = z
  .string()
  .min(2, 'Mã phòng tối thiểu 2 ký tự')
  .max(50, 'Mã phòng tối đa 50 ký tự')
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Mã phòng chỉ gồm chữ thường, số và dấu gạch ngang');

export const RoomsQuerySchema = z.object({
  /** Mặc định chỉ trả phòng đang hoạt động; admin xem được cả phòng đã ẩn. */
  includeInactive: z.coerce.boolean().optional().default(false),
});
export type RoomsQuery = z.infer<typeof RoomsQuerySchema>;

const NullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const HHmmSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-4]):[0-5]\d$/, 'Giờ phải có dạng HH:mm');

export const CreateRoomBodySchema = z.object({
  name: z.string().trim().min(2, 'Vui lòng nhập tên phòng').max(150),
  code: RoomCodeSchema,
  location: NullableText(150),
  capacity: z.coerce.number().int().min(0).max(1000).nullable().optional(),
  description: NullableText(2000),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
});
export type CreateRoomBody = z.infer<typeof CreateRoomBodySchema>;

export const UpdateRoomBodySchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  code: RoomCodeSchema.optional(),
  location: NullableText(150),
  capacity: z.coerce.number().int().min(0).max(1000).nullable().optional(),
  description: NullableText(2000),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});
export type UpdateRoomBody = z.infer<typeof UpdateRoomBodySchema>;

/** Ghi đè nội quy của phòng. Chưa có thì tạo, có rồi thì thay nội dung. */
export const UpsertRoomRuleBodySchema = z.object({
  content: z.string().trim().min(10, 'Nội quy cần tối thiểu 10 ký tự').max(20000),
});
export type UpsertRoomRuleBody = z.infer<typeof UpsertRoomRuleBodySchema>;

export const UpdateRoomBookingSettingBodySchema = z
  .object({
    openTime: HHmmSchema.optional(),
    closeTime: HHmmSchema.optional(),
    // 0 = TẮT hẳn việc bắt giờ rơi vào mốc: người mượn gõ giờ lẻ tuỳ ý
    // (11:15–11:40). Lịch tuần vẫn vẽ lưới 30 phút, xem `displayStepMinutes`.
    slotStepMinutes: z.coerce.number().int().min(0).max(120).optional(),
    minDurationMinutes: z.coerce.number().int().min(5).max(480).optional(),
    maxDurationMinutes: z.coerce.number().int().min(5).max(720).optional(),
    maxAdvanceDays: z.coerce.number().int().min(0).max(365).optional(),
    allowWeekend: z.boolean().optional(),
    checkinWindowMinutes: z.coerce.number().int().min(0).max(240).optional(),
    minPhotosPerHandover: z.coerce.number().int().min(0).max(20).optional(),
    maxPhotosPerHandover: z.coerce.number().int().min(0).max(50).optional(),
    photoRetentionMonths: z.coerce.number().int().min(1).max(120).optional(),
  })
  .refine(
    (value) =>
      value.minDurationMinutes === undefined ||
      value.maxDurationMinutes === undefined ||
      value.minDurationMinutes <= value.maxDurationMinutes,
    {
      message: 'Thời lượng tối thiểu không được lớn hơn thời lượng tối đa',
      path: ['minDurationMinutes'],
    }
  )
  .refine(
    (value) =>
      value.minPhotosPerHandover === undefined ||
      value.maxPhotosPerHandover === undefined ||
      value.minPhotosPerHandover <= value.maxPhotosPerHandover,
    {
      message: 'Số ảnh tối thiểu không được lớn hơn số ảnh tối đa',
      path: ['minPhotosPerHandover'],
    }
  );
export type UpdateRoomBookingSettingBody = z.infer<typeof UpdateRoomBookingSettingBodySchema>;

export const CreateEquipmentBodySchema = z.object({
  name: z.string().trim().min(2, 'Vui lòng nhập tên thiết bị').max(150),
  code: NullableText(50),
  unit: z.string().trim().min(1).max(30).optional().default('cái'),
  totalQuantity: z.coerce.number().int().min(0).max(10000),
  description: NullableText(1000),
  isActive: z.boolean().optional().default(true),
});
export type CreateEquipmentBody = z.infer<typeof CreateEquipmentBodySchema>;

export const UpdateEquipmentBodySchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  code: NullableText(50),
  unit: z.string().trim().min(1).max(30).optional(),
  totalQuantity: z.coerce.number().int().min(0).max(10000).optional(),
  description: NullableText(1000),
  isActive: z.boolean().optional(),
});
export type UpdateEquipmentBody = z.infer<typeof UpdateEquipmentBodySchema>;

/** Mốc thời gian truyền qua API luôn là chuỗi ISO 8601 có múi giờ. */
const IsoDateTime = z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
  message: 'Thời gian không hợp lệ',
});

export const RoomBookingsQuerySchema = z.object({
  roomId: z.string().min(1).optional(),
  /** Khoảng thời gian cần lấy — lịch tuần gửi mốc đầu và cuối tuần. */
  from: IsoDateTime,
  to: IsoDateTime,
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : undefined)),
  department: z.string().optional(),
  /** Chỉ lấy đơn của chính mình. */
  mine: z.coerce.boolean().optional().default(false),
});
export type RoomBookingsQuery = z.infer<typeof RoomBookingsQuerySchema>;

const BookingIdentitySchema = {
  fullName: z.string().trim().min(2, 'Vui lòng nhập họ và tên').max(150),
  staffCode: z.string().trim().max(50).nullable().optional(),
  department: z.string().trim().max(150).nullable().optional(),
  reason: z
    .string()
    .trim()
    .min(5, 'Vui lòng ghi rõ lý do mượn phòng (tối thiểu 5 ký tự)')
    .max(1000),
};

export const CreateRoomBookingBodySchema = z.object({
  roomId: z.string().min(1, 'Thiếu phòng'),
  ...BookingIdentitySchema,
  startAt: IsoDateTime,
  endAt: IsoDateTime,
});
export type CreateRoomBookingBody = z.infer<typeof CreateRoomBookingBodySchema>;

export const UpdateRoomBookingBodySchema = z.object({
  roomId: z.string().min(1).optional(),
  fullName: BookingIdentitySchema.fullName.optional(),
  staffCode: BookingIdentitySchema.staffCode,
  department: BookingIdentitySchema.department,
  reason: BookingIdentitySchema.reason.optional(),
  startAt: IsoDateTime.optional(),
  endAt: IsoDateTime.optional(),
});
export type UpdateRoomBookingBody = z.infer<typeof UpdateRoomBookingBodySchema>;

export const RejectRoomBookingBodySchema = z.object({
  reason: z.string().trim().min(5, 'Vui lòng nêu rõ lý do từ chối (tối thiểu 5 ký tự)').max(1000),
});
export type RejectRoomBookingBody = z.infer<typeof RejectRoomBookingBodySchema>;

export const BulkApproveBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'Chưa chọn đơn nào').max(100),
});
export type BulkApproveBody = z.infer<typeof BulkApproveBodySchema>;

export const PendingBookingsQuerySchema = z.object({
  roomId: z.string().min(1).optional(),
  department: z.string().optional(),
});
export type PendingBookingsQuery = z.infer<typeof PendingBookingsQuerySchema>;

export const EquipmentBookingsQuerySchema = RoomBookingsQuerySchema;
export type EquipmentBookingsQuery = z.infer<typeof EquipmentBookingsQuerySchema>;

const EquipmentBookingItemInputSchema = z.object({
  equipmentId: z.string().min(1, 'Thiếu thiết bị'),
  quantity: z.coerce.number().int().min(1, 'Số lượng phải lớn hơn 0').max(10000),
});

const EquipmentBookingIdentitySchema = {
  ...BookingIdentitySchema,
  reason: z
    .string()
    .trim()
    .min(5, 'Vui lòng ghi rõ lý do mượn thiết bị (tối thiểu 5 ký tự)')
    .max(1000),
};

export const CreateEquipmentBookingBodySchema = z
  .object({
    roomId: z.string().min(1, 'Thiếu phòng quản lý thiết bị'),
    ...EquipmentBookingIdentitySchema,
    startAt: IsoDateTime,
    endAt: IsoDateTime,
    items: z.array(EquipmentBookingItemInputSchema).min(1, 'Chưa chọn thiết bị').max(50),
  })
  .refine((value) => new Set(value.items.map((i) => i.equipmentId)).size === value.items.length, {
    message: 'Mỗi thiết bị chỉ được chọn một dòng',
    path: ['items'],
  });
export type CreateEquipmentBookingBody = z.infer<typeof CreateEquipmentBookingBodySchema>;

export const UpdateEquipmentBookingBodySchema = z
  .object({
    roomId: z.string().min(1).optional(),
    fullName: EquipmentBookingIdentitySchema.fullName.optional(),
    staffCode: EquipmentBookingIdentitySchema.staffCode,
    department: EquipmentBookingIdentitySchema.department,
    reason: EquipmentBookingIdentitySchema.reason.optional(),
    startAt: IsoDateTime.optional(),
    endAt: IsoDateTime.optional(),
    items: z.array(EquipmentBookingItemInputSchema).min(1).max(50).optional(),
  })
  .refine(
    (value) =>
      value.items === undefined ||
      new Set(value.items.map((i) => i.equipmentId)).size === value.items.length,
    {
      message: 'Mỗi thiết bị chỉ được chọn một dòng',
      path: ['items'],
    }
  );
export type UpdateEquipmentBookingBody = z.infer<typeof UpdateEquipmentBookingBodySchema>;

// ── Bàn giao ───────────────────────────────────────────────────

export const HandoverFieldTypeSchema = z.enum(['NUMBER', 'TEXT', 'SELECT', 'BOOLEAN']);
export const HandoverFieldAppliesSchema = z.enum(['CHECKIN', 'CHECKOUT', 'BOTH']);

/** Khoá của trường bàn giao — dùng làm khoá trong JSON fieldValues. */
export const HandoverFieldKeySchema = z
  .string()
  .trim()
  .min(2, 'Khoá tối thiểu 2 ký tự')
  .max(50, 'Khoá tối đa 50 ký tự')
  .regex(/^[a-z0-9_]+$/, 'Khoá chỉ gồm chữ thường, số và dấu gạch dưới');

export const CreateHandoverFieldBodySchema = z
  .object({
    /** null = trường dùng chung cho mọi phòng. */
    roomId: z.string().min(1).nullable().optional(),
    key: HandoverFieldKeySchema,
    label: z.string().trim().min(2, 'Vui lòng nhập nhãn hiển thị').max(150),
    dataType: HandoverFieldTypeSchema,
    options: z.array(z.string().trim().min(1)).max(50).optional(),
    isRequired: z.boolean().optional().default(false),
    appliesTo: HandoverFieldAppliesSchema.optional().default('BOTH'),
    sortOrder: z.number().int().min(0).max(999).optional().default(0),
  })
  .refine((v) => v.dataType !== 'SELECT' || (v.options?.length ?? 0) >= 2, {
    message: 'Trường dạng chọn cần ít nhất 2 lựa chọn',
    path: ['options'],
  });
export type CreateHandoverFieldBody = z.infer<typeof CreateHandoverFieldBodySchema>;

export const UpdateHandoverFieldBodySchema = z.object({
  label: z.string().trim().min(2).max(150).optional(),
  options: z.array(z.string().trim().min(1)).max(50).nullable().optional(),
  isRequired: z.boolean().optional(),
  appliesTo: HandoverFieldAppliesSchema.optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateHandoverFieldBody = z.infer<typeof UpdateHandoverFieldBodySchema>;

export const HandoverFieldsQuerySchema = z.object({
  roomId: z.string().min(1).optional(),
  /** Lượt bàn giao cần lấy trường; bỏ trống thì trả về tất cả. */
  applies: z.enum(['CHECKIN', 'CHECKOUT']).optional(),
  includeInactive: z.coerce.boolean().optional().default(false),
});
export type HandoverFieldsQuery = z.infer<typeof HandoverFieldsQuerySchema>;

/** Giá trị một trường bàn giao. Kiểu phụ thuộc dataType của trường. */
export const HandoverFieldValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const HandoverPhotoInputSchema = z.object({
  bucket: z.string().trim().min(1).max(100),
  objectName: z.string().trim().min(1).max(500),
  mime: z.string().trim().min(1).max(100),
  size: z.coerce
    .number()
    .int()
    .min(1)
    .max(10 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i, 'Mã kiểm tra ảnh không hợp lệ'),
  width: z.coerce.number().int().min(1).max(20000),
  height: z.coerce.number().int().min(1).max(20000),
  capturedAtClient: IsoDateTime.nullable().optional(),
});
export type HandoverPhotoInput = z.infer<typeof HandoverPhotoInputSchema>;

export const SubmitHandoverBodySchema = z.object({
  /** Bắt buộc true khi nhận phòng — người mượn xác nhận đã đọc nội quy. */
  ruleAccepted: z.boolean().optional().default(false),
  conditionNote: z
    .string()
    .trim()
    .min(5, 'Vui lòng mô tả tình trạng phòng (tối thiểu 5 ký tự)')
    .max(2000),
  fieldValues: z.record(z.string(), HandoverFieldValueSchema).default({}),
  photos: z.array(HandoverPhotoInputSchema).max(50).default([]),
});
export type SubmitHandoverBody = z.infer<typeof SubmitHandoverBodySchema>;

export const UpdateStaffProfileBodySchema = z.object({
  staffCode: z.string().trim().max(50, 'Mã nhân viên tối đa 50 ký tự').nullable(),
  department: z.string().trim().max(150, 'Tổ chuyên môn tối đa 150 ký tự').nullable(),
});
export type UpdateStaffProfileBody = z.infer<typeof UpdateStaffProfileBodySchema>;

// ── DTO trả về ─────────────────────────────────────────────────

export type RoomListItem = {
  id: string;
  name: string;
  code: string;
  location: string | null;
  capacity: number | null;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  equipmentCount: number;
  /** Số đơn đang chờ duyệt — chỉ điền cho admin, null với vai trò khác. */
  pendingBookingCount: number | null;
};

export type RoomDetail = RoomListItem & {
  /** Nội quy của phòng; null khi admin chưa soạn. Mỗi phòng đúng một bản. */
  currentRule: RoomRuleDto | null;
  equipment: RoomEquipmentItem[];
  setting: RoomBookingSettingDto;
};

export type RoomEquipmentItem = {
  id: string;
  name: string;
  code: string | null;
  unit: string;
  totalQuantity: number;
  description: string | null;
  isActive: boolean;
};

export type RoomBookingSettingDto = {
  openTime: string;
  closeTime: string;
  slotStepMinutes: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  maxAdvanceDays: number;
  allowWeekend: boolean;
  checkinWindowMinutes: number;
  minPhotosPerHandover: number;
  maxPhotosPerHandover: number;
  photoRetentionMonths: number;
  /** true = đang dùng bản mặc định toàn hệ thống, phòng chưa có cấu hình riêng. */
  isDefault: boolean;
};

export type StaffProfileDto = {
  staffCode: string | null;
  department: string | null;
};

/** Một đơn mượn phòng như lịch cần để vẽ. Mốc thời gian là chuỗi ISO. */
export type RoomBookingListItem = {
  id: string;
  roomId: string;
  roomName: string;
  roomCode: string;
  userId: string;
  fullName: string;
  staffCode: string | null;
  department: string | null;
  reason: string;
  startAt: string;
  endAt: string;
  status: RoomBookingStatusValue;
  /** Người đang xem có phải chủ đơn không — quyết định hiện nút sửa/huỷ. */
  isMine: boolean;
};

export type RoomBookingDetail = RoomBookingListItem & {
  /** Nội quy HIỆN HÀNH của phòng. Admin sửa thì đơn cũ cũng hiện theo bản mới. */
  ruleContent: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectReason: string | null;
  keyReturnedAt: string | null;
  hasDiscrepancy: boolean;
  createdAt: string;
  /** Hành động người đang xem được phép làm tiếp, đã tính cả vai trò. */
  availableActions: string[];
};

export type RoomRuleDto = {
  content: string;
  /** Lần sửa gần nhất — thay cho số bản, để admin biết nội quy có mới không. */
  updatedAt: string;
};

export type EquipmentBookingItemDto = {
  equipmentId: string;
  equipmentName: string;
  equipmentCode: string | null;
  unit: string;
  quantity: number;
};

export type EquipmentBookingListItem = {
  id: string;
  roomId: string;
  roomName: string;
  roomCode: string;
  userId: string;
  fullName: string;
  staffCode: string | null;
  department: string | null;
  reason: string;
  startAt: string;
  endAt: string;
  status: RoomBookingStatusValue;
  isMine: boolean;
  items: EquipmentBookingItemDto[];
};

export type EquipmentAvailabilityIssue = {
  equipmentId: string;
  equipmentName: string;
  requested: number;
  available: number;
  totalQuantity: number;
};

export type EquipmentBookingDetail = EquipmentBookingListItem & {
  ruleContent: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectReason: string | null;
  returnedAt: string | null;
  hasDiscrepancy: boolean;
  createdAt: string;
  availableActions: string[];
};

export type HandoverFieldDto = {
  id: string;
  roomId: string | null;
  key: string;
  label: string;
  dataType: 'NUMBER' | 'TEXT' | 'SELECT' | 'BOOLEAN';
  options: string[] | null;
  isRequired: boolean;
  appliesTo: 'CHECKIN' | 'CHECKOUT' | 'BOTH';
  sortOrder: number;
  isActive: boolean;
  /** true = trường dùng chung cho mọi phòng (roomId null). */
  isShared: boolean;
};

export type HandoverPhotoDto = {
  id: string;
  /** Đường dẫn tải ảnh qua endpoint có kiểm quyền, không phải URL công khai. */
  url: string;
  width: number;
  height: number;
  serverReceivedAt: string;
  flagged: boolean;
};

export type HandoverDto = {
  id: string;
  type: 'CHECKIN' | 'CHECKOUT';
  performedByName: string | null;
  performedAt: string;
  ruleAccepted: boolean;
  conditionNote: string;
  fieldValues: Record<string, string | number | boolean | null>;
  photos: HandoverPhotoDto[];
};

/** Một dòng đối chiếu số liệu giữa lúc nhận và lúc trả. */
export type HandoverDiffRow = {
  key: string;
  label: string;
  checkinValue: string | number | boolean | null;
  checkoutValue: string | number | boolean | null;
  /** true = hai giá trị khác nhau. */
  changed: boolean;
  /** Chỉ có với trường dạng số: trả về ít hơn lúc nhận bao nhiêu. */
  shortfall: number | null;
};

/** Toàn cảnh bàn giao của một đơn, dùng cho màn hình chi tiết và trả phòng. */
export type BookingHandoverSummary = {
  bookingId: string;
  checkin: HandoverDto | null;
  checkout: HandoverDto | null;
  diff: HandoverDiffRow[];
  hasDiscrepancy: boolean;
};

/** Kết quả duyệt hàng loạt — báo rõ từng đơn thay vì chỉ tổng số. */
// ── Báo cáo ────────────────────────────────────────────────────

export const ReportGroupBySchema = z.enum(['room', 'department', 'month']);
export type ReportGroupBy = z.infer<typeof ReportGroupBySchema>;

export const RoomReportQuerySchema = z.object({
  from: IsoDateTime,
  to: IsoDateTime,
  roomId: z.string().min(1).optional(),
  groupBy: ReportGroupBySchema.optional().default('room'),
});
export type RoomReportQuery = z.infer<typeof RoomReportQuerySchema>;

export const REPORT_GROUP_BY_LABEL: Record<ReportGroupBy, string> = {
  room: 'Theo phòng',
  department: 'Theo tổ chuyên môn',
  month: 'Theo tháng',
};

/** Một dòng thống kê tần suất sử dụng. */
export type UsageReportRow = {
  key: string;
  label: string;
  bookingCount: number;
  /** Tổng số giờ đã đăng ký, làm tròn 2 chữ số thập phân. */
  totalHours: number;
  completedCount: number;
  noShowCount: number;
  cancelledCount: number;
  rejectedCount: number;
};

export type UsageReport = {
  groupBy: ReportGroupBy;
  from: string;
  to: string;
  rows: UsageReportRow[];
  /** Tổng của toàn khoảng, không phải chỉ của trang đang xem. */
  total: { bookingCount: number; totalHours: number };
};

export type NoShowReportRow = {
  id: string;
  roomName: string;
  fullName: string;
  staffCode: string | null;
  department: string | null;
  reason: string;
  startAt: string;
  endAt: string;
};

/** Một đơn có số liệu bàn giao lệch, kèm chi tiết thiếu hụt. */
export type DiscrepancyReportRow = {
  bookingId: string;
  roomName: string;
  fullName: string;
  department: string | null;
  startAt: string;
  endAt: string;
  checkoutAt: string | null;
  adminReviewNote: string | null;
  /** Chỉ các trường TRẢ THIẾU so với lúc nhận. */
  shortfalls: {
    key: string;
    label: string;
    checkinValue: number;
    checkoutValue: number;
    shortfall: number;
  }[];
};

export type BulkApproveResult = {
  approved: string[];
  failed: { id: string; reason: string }[];
};

/** Một đơn trong hàng chờ duyệt, kèm cảnh báo xung đột cho admin. */
export type PendingBookingItem = RoomBookingListItem & {
  createdAt: string;
  /**
   * Các đơn PENDING khác cùng phòng và giao nhau về thời gian. Ràng buộc CSDL
   * đã chặn không cho hai đơn trùng cùng tồn tại, nên danh sách này bình thường
   * luôn rỗng; nó tồn tại để bắt trường hợp dữ liệu cũ hoặc admin tự sửa tay.
   */
  conflictsWith: { id: string; fullName: string; startAt: string; endAt: string }[];
};

export type PendingEquipmentBookingItem = EquipmentBookingListItem & {
  createdAt: string;
  availabilityIssues: EquipmentAvailabilityIssue[];
};

/**
 * Giá trị dùng khi CHƯA có bản cấu hình nào trong CSDL (kể cả bản mặc định
 * toàn hệ thống). Phải khớp với `@default(...)` của model RoomBookingSetting —
 * lệch nhau thì hành vi trước và sau khi seeder chạy sẽ khác nhau.
 */
export const DEFAULT_ROOM_BOOKING_SETTING: Omit<RoomBookingSettingDto, 'isDefault'> = {
  openTime: '07:00',
  closeTime: '17:30',
  slotStepMinutes: 30,
  minDurationMinutes: 30,
  maxDurationMinutes: 300,
  maxAdvanceDays: 30,
  allowWeekend: true,
  checkinWindowMinutes: 15,
  minPhotosPerHandover: 1,
  maxPhotosPerHandover: 5,
  photoRetentionMonths: 12,
};

/** Lưới thời gian dùng để VẼ lịch tuần — luôn dương. */
const DISPLAY_STEP_FALLBACK_MINUTES = 30;

/**
 * Bước lưới để vẽ lịch, tách khỏi bước đặt chỗ.
 *
 * `slotStepMinutes = 0` nghĩa là không ép giờ vào mốc nào cả, nhưng lịch thì
 * vẫn phải có lưới để vẽ — lấy 0 mà chia là ra vô số dòng. Trường hợp đó dùng
 * lưới 30 phút, đủ thưa để nhìn được cả ngày làm việc trong một màn hình.
 */
export function displayStepMinutes(
  setting: Pick<RoomBookingSettingDto, 'slotStepMinutes'>
): number {
  return setting.slotStepMinutes > 0 ? setting.slotStepMinutes : DISPLAY_STEP_FALLBACK_MINUTES;
}

/**
 * Giá trị cho thuộc tính `step` của `<input type="time">`, tính bằng GIÂY.
 *
 * Bước 0 phải đổi thành 60 chứ không truyền thẳng: `step={0}` là giá trị không
 * hợp lệ theo chuẩn HTML, trình duyệt lặng lẽ quay về mặc định — không lỗi,
 * nhưng phụ thuộc vào từng trình duyệt. Nêu đích danh 60 (một phút) để mọi nơi
 * cho gõ giờ lẻ như nhau.
 */
export function timeInputStepSeconds(
  setting: Pick<RoomBookingSettingDto, 'slotStepMinutes'>
): number {
  return setting.slotStepMinutes > 0 ? setting.slotStepMinutes * 60 : 60;
}
