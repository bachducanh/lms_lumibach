'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  DoorOpen,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  ScrollText,
  Settings,
  Trash2,
} from 'lucide-react';
import {
  HANDOVER_FIELD_APPLIES,
  HANDOVER_FIELD_TYPES,
  vnDateTimeLabel,
  type HandoverFieldDto,
  type RoomBookingSettingDto,
  type RoomDetail,
  type RoomEquipmentItem,
  type RoomListItem,
} from '@lumibach/types';
import { apiClient, ApiError } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select as SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/editor/RichTextEditor';

type RoomForm = {
  name: string;
  code: string;
  location: string;
  capacity: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
};

type EquipmentForm = {
  name: string;
  code: string;
  unit: string;
  totalQuantity: string;
  description: string;
  isActive: boolean;
};

type FieldDraft = {
  key: string;
  label: string;
  dataType: HandoverFieldDto['dataType'];
  options: string;
  appliesTo: HandoverFieldDto['appliesTo'];
  sortOrder: string;
  isRequired: boolean;
  shared: boolean;
};

const emptyRoom: RoomForm = {
  name: '',
  code: '',
  location: '',
  capacity: '',
  description: '',
  sortOrder: '0',
  isActive: true,
};

const emptyEquipment: EquipmentForm = {
  name: '',
  code: '',
  unit: 'cái',
  totalQuantity: '1',
  description: '',
  isActive: true,
};

const emptyField: FieldDraft = {
  key: '',
  label: '',
  dataType: 'NUMBER',
  options: '',
  appliesTo: 'BOTH',
  sortOrder: '0',
  isRequired: false,
  shared: false,
};

export function AdminRoomsManager({ rooms }: { rooms: RoomListItem[] }) {
  const router = useRouter();
  const [selectedCode, setSelectedCode] = useState(rooms[0]?.code ?? null);
  const [detail, setDetail] = useState<RoomDetail | null>(null);
  const [fields, setFields] = useState<HandoverFieldDto[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [roomForm, setRoomForm] = useState<RoomForm>(emptyRoom);
  const [ruleHtml, setRuleHtml] = useState('');
  const [settingForm, setSettingForm] = useState<RoomBookingSettingDto | null>(null);
  const [equipmentEdits, setEquipmentEdits] = useState<Record<string, EquipmentForm>>({});
  const [equipmentDraft, setEquipmentDraft] = useState<EquipmentForm>(emptyEquipment);
  const [fieldDraft, setFieldDraft] = useState<FieldDraft>(emptyField);

  const selectedFromList = useMemo(
    () => rooms.find((room) => room.code === selectedCode) ?? null,
    [rooms, selectedCode]
  );

  useEffect(() => {
    if (!selectedCode) {
      setDetail(null);
      setFields([]);
      return;
    }
    // Cố ý chỉ phụ thuộc selectedCode: loadRoom được dựng lại mỗi lần render,
    // đưa nó vào danh sách phụ thuộc sẽ tải lại phòng liên tục.
    void loadRoom(selectedCode);
  }, [selectedCode]);

  useEffect(() => {
    if (!detail) return;
    setCreatingRoom(false);
    setRoomForm(toRoomForm(detail));
    setRuleHtml(detail.currentRule?.content ?? '');
    setSettingForm(detail.setting);
    setEquipmentEdits(
      Object.fromEntries(detail.equipment.map((item) => [item.id, toEquipmentForm(item)]))
    );
  }, [detail]);

  async function loadRoom(code: string) {
    setLoading(true);
    setLoadError(null);
    try {
      const room = await apiClient.get<RoomDetail>(`/rooms/${encodeURIComponent(code)}`);
      const loadedFields = await apiClient.get<HandoverFieldDto[]>(
        `/handover-fields?roomId=${room.id}&includeInactive=true`
      );
      setDetail(room);
      setFields(loadedFields);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Không tải được chi tiết phòng.');
    } finally {
      setLoading(false);
    }
  }

  function beginCreateRoom() {
    setCreatingRoom(true);
    setDetail(null);
    setFields([]);
    setRoomForm(emptyRoom);
    setRuleHtml('');
    setSettingForm(null);
  }

  function saveRoom() {
    startTransition(async () => {
      try {
        const payload = roomPayload(roomForm);
        const saved = creatingRoom
          ? await apiClient.post<RoomDetail>('/rooms', payload)
          : await apiClient.patch<RoomDetail>(`/rooms/${detail?.id}`, payload);
        toast.success(creatingRoom ? 'Đã tạo phòng' : 'Đã lưu phòng');
        setSelectedCode(saved.code);
        setDetail(saved);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Không lưu được phòng.');
      }
    });
  }

  function deleteRoom() {
    if (!detail) return;
    startTransition(async () => {
      try {
        await apiClient.delete(`/rooms/${detail.id}`);
        toast.success('Đã ẩn phòng');
        setSelectedCode(null);
        setDetail(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Không xóa được phòng.');
      }
    });
  }

  function saveRule() {
    if (!detail) return;
    startTransition(async () => {
      try {
        await apiClient.put(`/rooms/${detail.id}/rule`, { content: ruleHtml });
        toast.success('Đã cập nhật nội quy');
        await loadRoom(detail.code);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Không lưu được nội quy.');
      }
    });
  }

  function saveSetting() {
    if (!detail || !settingForm) return;
    startTransition(async () => {
      try {
        const saved = await apiClient.patch<RoomBookingSettingDto>(
          `/rooms/${detail.id}/setting`,
          settingPayload(settingForm)
        );
        setSettingForm(saved);
        toast.success('Đã lưu tham số đặt phòng');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Không lưu được tham số.');
      }
    });
  }

  function addEquipment() {
    if (!detail) return;
    startTransition(async () => {
      try {
        await apiClient.post(`/rooms/${detail.id}/equipment`, equipmentPayload(equipmentDraft));
        toast.success('Đã thêm thiết bị');
        setEquipmentDraft(emptyEquipment);
        await loadRoom(detail.code);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Không thêm được thiết bị.');
      }
    });
  }

  function saveEquipment(id: string) {
    if (!detail) return;
    startTransition(async () => {
      try {
        await apiClient.patch(
          `/rooms/equipment/${id}`,
          equipmentPayload(equipmentEdits[id] ?? emptyEquipment)
        );
        toast.success('Đã lưu thiết bị');
        await loadRoom(detail.code);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Không lưu được thiết bị.');
      }
    });
  }

  function deleteEquipment(id: string) {
    if (!detail) return;
    startTransition(async () => {
      try {
        await apiClient.delete(`/rooms/equipment/${id}`);
        toast.success('Đã xóa hoặc ẩn thiết bị');
        await loadRoom(detail.code);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Không xóa được thiết bị.');
      }
    });
  }

  function addField() {
    if (!detail) return;
    startTransition(async () => {
      try {
        await apiClient.post('/handover-fields', {
          roomId: fieldDraft.shared ? null : detail.id,
          key: fieldDraft.key,
          label: fieldDraft.label,
          dataType: fieldDraft.dataType,
          options:
            fieldDraft.dataType === 'SELECT'
              ? fieldDraft.options
                  .split(/\r?\n|,/)
                  .map((item) => item.trim())
                  .filter(Boolean)
              : undefined,
          isRequired: fieldDraft.isRequired,
          appliesTo: fieldDraft.appliesTo,
          sortOrder: Number(fieldDraft.sortOrder || 0),
        });
        toast.success('Đã thêm trường bàn giao');
        setFieldDraft(emptyField);
        await loadRoom(detail.code);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Không thêm được trường bàn giao.');
      }
    });
  }

  function toggleField(field: HandoverFieldDto) {
    if (!detail) return;
    startTransition(async () => {
      try {
        await apiClient.patch(`/handover-fields/${field.id}`, { isActive: !field.isActive });
        await loadRoom(detail.code);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Không cập nhật được trường.');
      }
    });
  }

  function deleteField(field: HandoverFieldDto) {
    if (!detail) return;
    startTransition(async () => {
      try {
        await apiClient.delete(`/handover-fields/${field.id}`);
        toast.success('Đã xóa hoặc ẩn trường bàn giao');
        await loadRoom(detail.code);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Không xóa được trường.');
      }
    });
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="space-y-3 xl:sticky xl:top-0 xl:self-start">
        <Button className="h-10 w-full" onClick={beginCreateRoom}>
          <Plus className="mr-2 h-4 w-4" />
          Tạo phòng
        </Button>
        <div className="border-border bg-card divide-border max-h-[calc(100dvh-15rem)] divide-y overflow-y-auto rounded-lg border">
          {rooms.length === 0 && (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">Chưa có phòng.</p>
          )}
          {rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => setSelectedCode(room.code)}
              className={`hover:bg-muted/50 block w-full px-4 py-3 text-left transition-colors ${
                room.code === selectedCode && !creatingRoom ? 'bg-primary/10 text-primary' : ''
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <DoorOpen className="h-4 w-4" />
                {room.name}
              </span>
              <span className="text-muted-foreground mt-1 block text-xs">
                {room.code}
                {!room.isActive && ' · đang ẩn'}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className="min-w-0 space-y-4">
        {loading && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải phòng...
          </p>
        )}

        {loadError && (
          <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border px-4 py-3 text-sm">
            {loadError}
          </p>
        )}

        {(creatingRoom || detail) && (
          <Card>
            <CardHeader>
              <CardTitle>Thông tin phòng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="Tên phòng"
                  value={roomForm.name}
                  onChange={(name) => setRoomForm((v) => ({ ...v, name }))}
                />
                <TextField
                  label="Mã URL"
                  value={roomForm.code}
                  onChange={(code) => setRoomForm((v) => ({ ...v, code: slugify(code) }))}
                />
                <TextField
                  label="Vị trí"
                  value={roomForm.location}
                  onChange={(location) => setRoomForm((v) => ({ ...v, location }))}
                />
                <TextField
                  label="Sức chứa"
                  type="number"
                  value={roomForm.capacity}
                  onChange={(capacity) => setRoomForm((v) => ({ ...v, capacity }))}
                />
                <TextField
                  label="Thứ tự"
                  type="number"
                  value={roomForm.sortOrder}
                  onChange={(sortOrder) => setRoomForm((v) => ({ ...v, sortOrder }))}
                />
                <SwitchRow
                  label="Đang hoạt động"
                  checked={roomForm.isActive}
                  onChange={(isActive) => setRoomForm((v) => ({ ...v, isActive }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Mô tả</Label>
                <Textarea
                  rows={3}
                  value={roomForm.description}
                  onChange={(e) => setRoomForm((v) => ({ ...v, description: e.target.value }))}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={saveRoom} disabled={pending}>
                  <Save className="mr-2 h-4 w-4" />
                  {creatingRoom ? 'Tạo phòng' : 'Lưu phòng'}
                </Button>
                {detail && (
                  <Button
                    variant="outline"
                    onClick={() => void loadRoom(detail.code)}
                    disabled={pending}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Tải lại
                  </Button>
                )}
                {detail && (
                  <Button variant="destructive" onClick={deleteRoom} disabled={pending}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Xóa phòng
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {detail && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ScrollText className="h-4 w-4" />
                  Nội quy phòng
                  {detail.currentRule && (
                    <Badge variant="outline">
                      Cập nhật {vnDateTimeLabel(new Date(detail.currentRule.updatedAt))}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* `content` chỉ được TipTap đọc ĐÚNG MỘT LẦN lúc dựng editor;
                    đổi prop sau đó không nạp lại nội dung. Nên phải truyền thẳng
                    giá trị của máy chủ, KHÔNG truyền `ruleHtml` — state đó do
                    useEffect điền SAU khi editor đã dựng xong, nên editor luôn
                    nhận giá trị của lượt trước: rỗng khi mới vào trang, và nội
                    quy của phòng vừa xem khi bấm sang phòng khác. Người dùng sửa
                    trên nội dung nhìn thấy rồi lưu là ghi nhầm sang phòng đang mở.

                    `key` gồm cả updatedAt để editor dựng lại đúng lúc bản nội quy
                    đổi (chuyển phòng, hoặc vừa lưu xong), chứ không dựng lại theo
                    từng phím gõ. */}
                <RichTextEditor
                  key={`${detail.id}:${detail.currentRule?.updatedAt ?? 'chua-co'}`}
                  content={detail.currentRule?.content ?? ''}
                  onChange={setRuleHtml}
                  compact
                  allowImages={false}
                  placeholder="Soạn nội quy phòng..."
                />
                {/* Ghi đè tại chỗ: bản cũ mất hẳn, và đơn đã duyệt từ trước
                    cũng hiện theo nội dung mới. */}
                <Button onClick={saveRule} disabled={pending || ruleHtml.trim().length < 10}>
                  <Save className="mr-2 h-4 w-4" />
                  Lưu nội quy
                </Button>
                <p className="text-muted-foreground text-xs">
                  Nội quy có hiệu lực ngay sau khi lưu, kể cả với đơn đã duyệt trước đó.
                </p>
              </CardContent>
            </Card>

            {settingForm && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Tham số đặt phòng
                    {settingForm.isDefault && <Badge variant="secondary">Đang dùng mặc định</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <SettingInput
                      label="Giờ mở"
                      value={settingForm.openTime}
                      onChange={(openTime) => setSettingForm((v) => v && { ...v, openTime })}
                    />
                    <SettingInput
                      label="Giờ đóng"
                      value={settingForm.closeTime}
                      onChange={(closeTime) => setSettingForm((v) => v && { ...v, closeTime })}
                    />
                    <SettingInput
                      label="Bước slot phút"
                      type="number"
                      hint="0 = cho đặt giờ lẻ tuỳ ý. Lịch vẫn vẽ lưới 30 phút."
                      value={settingForm.slotStepMinutes}
                      onChange={(slotStepMinutes) =>
                        setSettingForm(
                          (v) => v && { ...v, slotStepMinutes: Number(slotStepMinutes) }
                        )
                      }
                    />
                    <SettingInput
                      label="Tối thiểu phút"
                      type="number"
                      value={settingForm.minDurationMinutes}
                      onChange={(minDurationMinutes) =>
                        setSettingForm(
                          (v) => v && { ...v, minDurationMinutes: Number(minDurationMinutes) }
                        )
                      }
                    />
                    <SettingInput
                      label="Tối đa phút"
                      type="number"
                      value={settingForm.maxDurationMinutes}
                      onChange={(maxDurationMinutes) =>
                        setSettingForm(
                          (v) => v && { ...v, maxDurationMinutes: Number(maxDurationMinutes) }
                        )
                      }
                    />
                    <SettingInput
                      label="Đặt trước ngày"
                      type="number"
                      value={settingForm.maxAdvanceDays}
                      onChange={(maxAdvanceDays) =>
                        setSettingForm((v) => v && { ...v, maxAdvanceDays: Number(maxAdvanceDays) })
                      }
                    />
                    <SettingInput
                      label="Cửa sổ check-in phút"
                      type="number"
                      value={settingForm.checkinWindowMinutes}
                      onChange={(checkinWindowMinutes) =>
                        setSettingForm(
                          (v) => v && { ...v, checkinWindowMinutes: Number(checkinWindowMinutes) }
                        )
                      }
                    />
                    <SettingInput
                      label="Ảnh tối thiểu"
                      type="number"
                      value={settingForm.minPhotosPerHandover}
                      onChange={(minPhotosPerHandover) =>
                        setSettingForm(
                          (v) => v && { ...v, minPhotosPerHandover: Number(minPhotosPerHandover) }
                        )
                      }
                    />
                    <SettingInput
                      label="Ảnh tối đa"
                      type="number"
                      value={settingForm.maxPhotosPerHandover}
                      onChange={(maxPhotosPerHandover) =>
                        setSettingForm(
                          (v) => v && { ...v, maxPhotosPerHandover: Number(maxPhotosPerHandover) }
                        )
                      }
                    />
                    <SettingInput
                      label="Lưu ảnh tháng"
                      type="number"
                      value={settingForm.photoRetentionMonths}
                      onChange={(photoRetentionMonths) =>
                        setSettingForm(
                          (v) => v && { ...v, photoRetentionMonths: Number(photoRetentionMonths) }
                        )
                      }
                    />
                    <SwitchRow
                      label="Cho phép cuối tuần"
                      checked={settingForm.allowWeekend}
                      onChange={(allowWeekend) =>
                        setSettingForm((v) => v && { ...v, allowWeekend })
                      }
                    />
                  </div>
                  <Button onClick={saveSetting} disabled={pending}>
                    <Save className="mr-2 h-4 w-4" />
                    Lưu tham số
                  </Button>
                </CardContent>
              </Card>
            )}

            <EquipmentSection
              equipment={detail.equipment}
              edits={equipmentEdits}
              draft={equipmentDraft}
              pending={pending}
              setEdit={(id, patch) =>
                setEquipmentEdits((prev) => ({
                  ...prev,
                  [id]: { ...(prev[id] ?? emptyEquipment), ...patch },
                }))
              }
              setDraft={(patch) => setEquipmentDraft((prev) => ({ ...prev, ...patch }))}
              onAdd={addEquipment}
              onSave={saveEquipment}
              onDelete={deleteEquipment}
            />

            <HandoverFieldsSection
              fields={fields}
              draft={fieldDraft}
              pending={pending}
              setDraft={(patch) => setFieldDraft((prev) => ({ ...prev, ...patch }))}
              onAdd={addField}
              onToggle={toggleField}
              onDelete={deleteField}
            />
          </>
        )}

        {!creatingRoom && !selectedFromList && rooms.length === 0 && (
          <p className="text-muted-foreground rounded-xl border border-dashed px-6 py-12 text-center text-sm">
            Bấm “Tạo phòng” để khai báo phòng đầu tiên.
          </p>
        )}
      </main>
    </div>
  );
}

function EquipmentSection({
  equipment,
  edits,
  draft,
  pending,
  setEdit,
  setDraft,
  onAdd,
  onSave,
  onDelete,
}: {
  equipment: RoomEquipmentItem[];
  edits: Record<string, EquipmentForm>;
  draft: EquipmentForm;
  pending: boolean;
  setEdit: (id: string, patch: Partial<EquipmentForm>) => void;
  setDraft: (patch: Partial<EquipmentForm>) => void;
  onAdd: () => void;
  onSave: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Thiết bị</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-border divide-border divide-y rounded-lg border">
          {equipment.length === 0 && (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">
              Chưa khai báo thiết bị.
            </p>
          )}
          {equipment.map((item) => {
            const form = edits[item.id] ?? toEquipmentForm(item);
            return (
              <div key={item.id} className="space-y-3 px-4 py-3">
                <div className="grid gap-3 md:grid-cols-[1fr_7rem_6rem_7rem_auto]">
                  <Input
                    value={form.name}
                    onChange={(e) => setEdit(item.id, { name: e.target.value })}
                  />
                  <Input
                    value={form.code}
                    onChange={(e) => setEdit(item.id, { code: e.target.value })}
                    placeholder="Mã"
                  />
                  <Input
                    value={form.unit}
                    onChange={(e) => setEdit(item.id, { unit: e.target.value })}
                  />
                  <Input
                    type="number"
                    value={form.totalQuantity}
                    onChange={(e) => setEdit(item.id, { totalQuantity: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => onSave(item.id)} disabled={pending}>
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onDelete(item.id)}
                      disabled={pending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <Input
                    value={form.description}
                    onChange={(e) => setEdit(item.id, { description: e.target.value })}
                    placeholder="Mô tả"
                  />
                  <SwitchRow
                    label="Hoạt động"
                    checked={form.isActive}
                    onChange={(isActive) => setEdit(item.id, { isActive })}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-dashed p-4">
          <p className="mb-3 text-sm font-medium">Thêm thiết bị</p>
          <div className="grid gap-3 md:grid-cols-[1fr_7rem_6rem_7rem]">
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ name: e.target.value })}
              placeholder="Tên thiết bị"
            />
            <Input
              value={draft.code}
              onChange={(e) => setDraft({ code: e.target.value })}
              placeholder="Mã"
            />
            <Input
              value={draft.unit}
              onChange={(e) => setDraft({ unit: e.target.value })}
              placeholder="Đơn vị"
            />
            <Input
              type="number"
              value={draft.totalQuantity}
              onChange={(e) => setDraft({ totalQuantity: e.target.value })}
            />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
            <Input
              value={draft.description}
              onChange={(e) => setDraft({ description: e.target.value })}
              placeholder="Mô tả"
            />
            <Button onClick={onAdd} disabled={pending || draft.name.trim().length < 2}>
              <Plus className="mr-2 h-4 w-4" />
              Thêm
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HandoverFieldsSection({
  fields,
  draft,
  pending,
  setDraft,
  onAdd,
  onToggle,
  onDelete,
}: {
  fields: HandoverFieldDto[];
  draft: FieldDraft;
  pending: boolean;
  setDraft: (patch: Partial<FieldDraft>) => void;
  onAdd: () => void;
  onToggle: (field: HandoverFieldDto) => void;
  onDelete: (field: HandoverFieldDto) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trường bàn giao</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-border divide-border divide-y rounded-lg border">
          {fields.map((field) => (
            <div
              key={field.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{field.label}</p>
                  <Badge variant="outline">{field.key}</Badge>
                  <Badge variant={field.isShared ? 'secondary' : 'outline'}>
                    {field.isShared ? 'Dùng chung' : 'Riêng phòng'}
                  </Badge>
                  {!field.isActive && <Badge variant="destructive">Đang ẩn</Badge>}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {field.dataType} · {field.appliesTo} · thứ tự {field.sortOrder}
                  {field.isRequired && ' · bắt buộc'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onToggle(field)}
                  disabled={pending}
                >
                  {field.isActive ? 'Ẩn' : 'Hiện'}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onDelete(field)}
                  disabled={pending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {fields.length === 0 && (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">
              Chưa có trường bàn giao.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-dashed p-4">
          <p className="mb-3 text-sm font-medium">Thêm trường bàn giao</p>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              value={draft.key}
              onChange={(e) => setDraft({ key: fieldKey(e.target.value) })}
              placeholder="key_vi_du"
            />
            <Input
              value={draft.label}
              onChange={(e) => setDraft({ label: e.target.value })}
              placeholder="Nhãn hiển thị"
            />
            <Select
              ariaLabel="Kiểu dữ liệu"
              value={draft.dataType}
              onChange={(dataType) => setDraft({ dataType: dataType as FieldDraft['dataType'] })}
              options={HANDOVER_FIELD_TYPES}
            />
            <Select
              ariaLabel="Áp dụng cho lượt"
              value={draft.appliesTo}
              onChange={(appliesTo) =>
                setDraft({ appliesTo: appliesTo as FieldDraft['appliesTo'] })
              }
              options={HANDOVER_FIELD_APPLIES}
            />
            <Input
              type="number"
              value={draft.sortOrder}
              onChange={(e) => setDraft({ sortOrder: e.target.value })}
              placeholder="Thứ tự"
            />
            <SwitchRow
              label="Bắt buộc"
              checked={draft.isRequired}
              onChange={(isRequired) => setDraft({ isRequired })}
            />
            <SwitchRow
              label="Dùng chung mọi phòng"
              checked={draft.shared}
              onChange={(shared) => setDraft({ shared })}
            />
          </div>
          {draft.dataType === 'SELECT' && (
            <Textarea
              className="mt-3"
              rows={3}
              value={draft.options}
              onChange={(e) => setDraft({ options: e.target.value })}
              placeholder="Mỗi lựa chọn một dòng, hoặc ngăn cách bằng dấu phẩy"
            />
          )}
          <Button
            className="mt-3"
            onClick={onAdd}
            disabled={pending || draft.key.length < 2 || draft.label.trim().length < 2}
          >
            <Plus className="mr-2 h-4 w-4" />
            Thêm trường
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SettingInput({
  label,
  value,
  onChange,
  type = 'time',
  hint,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={String(value)} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/**
 * Ô chọn cho các form quản trị. Bọc `Select` dùng chung để giữ nguyên chữ ký
 * `{value, onChange, options}` mà các form ở file này đang dùng.
 */
function Select({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly { readonly value: string; readonly label: string }[];
  ariaLabel?: string;
}) {
  return (
    <SelectRoot
      value={value}
      onValueChange={(v) => onChange((v as string) ?? '')}
      items={options.map((o) => ({ label: o.label, value: o.value }))}
    >
      <SelectTrigger aria-label={ariaLabel} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );
}

function toRoomForm(room: RoomDetail): RoomForm {
  return {
    name: room.name,
    code: room.code,
    location: room.location ?? '',
    capacity: room.capacity === null ? '' : String(room.capacity),
    description: room.description ?? '',
    sortOrder: String(room.sortOrder),
    isActive: room.isActive,
  };
}

function roomPayload(form: RoomForm) {
  return {
    name: form.name,
    code: form.code,
    location: form.location.trim() || null,
    capacity: form.capacity === '' ? null : Number(form.capacity),
    description: form.description.trim() || null,
    sortOrder: Number(form.sortOrder || 0),
    isActive: form.isActive,
  };
}

function toEquipmentForm(item: RoomEquipmentItem): EquipmentForm {
  return {
    name: item.name,
    code: item.code ?? '',
    unit: item.unit,
    totalQuantity: String(item.totalQuantity),
    description: item.description ?? '',
    isActive: item.isActive,
  };
}

function equipmentPayload(form: EquipmentForm) {
  return {
    name: form.name,
    code: form.code.trim() || null,
    unit: form.unit.trim() || 'cái',
    totalQuantity: Number(form.totalQuantity || 0),
    description: form.description.trim() || null,
    isActive: form.isActive,
  };
}

function settingPayload(form: RoomBookingSettingDto) {
  const { isDefault: _isDefault, ...rest } = form;
  return rest;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function fieldKey(value: string): string {
  return slugify(value).replace(/-/g, '_');
}
