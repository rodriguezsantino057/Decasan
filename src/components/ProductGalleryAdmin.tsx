import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Trash2, GripVertical, Edit3 } from "lucide-react";
import { adminListProductImages, adminAddProductImage, adminReorderProductImages, adminDeleteProductImage } from "@/lib/admin.functions";
import { ProductImage } from "./ProductImage";
import { ImageCropper } from "./ImageCropper";
import { uploadProductImage, fileToDataUrl } from "@/lib/image-upload";

type Props = { productoId: number };

type Row = { id: string; url: string | null; url_webp: string | null; alt: string | null; orden: number };

export function ProductGalleryAdmin({ productoId }: Props) {
  const qc = useQueryClient();
  const list = useServerFn(adminListProductImages);
  const add = useServerFn(adminAddProductImage);
  const reorder = useServerFn(adminReorderProductImages);
  const remove = useServerFn(adminDeleteProductImage);

  const [items, setItems] = useState<Row[]>([]);
  const [queue, setQueue] = useState<{ src: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["product-images", productoId],
    queryFn: () => list({ data: { producto_id: productoId } }),
  });

  useEffect(() => {
    if (data) setItems(data as Row[]);
  }, [data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function onDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex).map((it, i) => ({ ...it, orden: i }));
    setItems(next);
    try {
      await reorder({ data: { producto_id: productoId, items: next.map(({ id, orden }) => ({ id, orden })) } });
      qc.invalidateQueries({ queryKey: ["product-images", productoId] });
      qc.invalidateQueries({ queryKey: ["admin-productos"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Error al reordenar");
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const arr: { src: string; name: string }[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      const src = await fileToDataUrl(f);
      arr.push({ src, name: f.name });
    }
    setQueue(arr);
  }

  async function onConfirmCrop(blob: Blob, ext: "webp" | "jpeg") {
    setBusy(true);
    try {
      const { url, isWebp } = await uploadProductImage(blob, ext, productoId);
      await add({ data: {
        producto_id: productoId,
        url: isWebp ? null : url,
        url_webp: isWebp ? url : null,
      } });
      toast.success("Imagen agregada");
      setQueue((q) => q.slice(1));
      qc.invalidateQueries({ queryKey: ["product-images", productoId] });
      qc.invalidateQueries({ queryKey: ["admin-productos"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Error al subir");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("¿Eliminar esta imagen?")) return;
    try {
      await remove({ data: { id } });
      toast.success("Eliminada");
      qc.invalidateQueries({ queryKey: ["product-images", productoId] });
      qc.invalidateQueries({ queryKey: ["admin-productos"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  }

  async function onEditCrop(item: Row) {
    const src = item.url_webp || item.url;
    if (!src) return;
    setQueue([{ src, name: item.id }]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Galería · {items.length} {items.length === 1 ? "imagen" : "imágenes"}
        </div>
        <label className="inline-flex w-full items-center justify-center gap-1.5 border border-border px-3 py-2 text-xs cursor-pointer hover:border-primary sm:w-auto sm:py-1.5">
          <Plus className="size-3.5" /> Subir imágenes
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(e) => { onFiles(e.target.files); e.currentTarget.value = ""; }}
          />
        </label>
      </div>

      {items.length === 0 && (
        <div className="border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Sin imágenes. Subí una o varias — la primera será la principal.
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {items.map((it, i) => (
              <SortableThumb
                key={it.id}
                item={it}
                isPrincipal={i === 0}
                onDelete={() => onDelete(it.id)}
                onEdit={() => onEditCrop(it)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="text-[11px] text-muted-foreground">
        Arrastrá para reordenar. La <strong>primera</strong> imagen es la principal y se usa en el catálogo.
      </div>

      {queue.length > 0 && (
        <ImageCropper
          key={queue[0].src}
          src={queue[0].src}
          aspect={1}
          onCancel={() => setQueue((q) => q.slice(1))}
          onConfirm={onConfirmCrop}
        />
      )}
    </div>
  );
}

function SortableThumb({ item, isPrincipal, onDelete, onEdit }: {
  item: Row; isPrincipal: boolean; onDelete: () => void; onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative group aspect-square border border-border bg-muted overflow-hidden">
      <ProductImage webp={item.url_webp} src={item.url} alt={item.alt ?? ""} className="size-full" iconClassName="size-8" sizes="200px" />
      {isPrincipal && (
        <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5">
          Principal
        </span>
      )}
      <button
        {...attributes}
        {...listeners}
        className="absolute top-1 right-1 size-7 sm:size-6 grid place-items-center bg-background/90 border border-border opacity-100 sm:opacity-0 sm:group-hover:opacity-100 cursor-grab active:cursor-grabbing"
        aria-label="Reordenar"
      >
        <GripVertical className="size-3.5" />
      </button>
      <div className="absolute bottom-1 right-1 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
        <button onClick={onEdit} className="size-7 sm:size-6 grid place-items-center bg-background/90 border border-border hover:text-primary" aria-label="Editar recorte">
          <Edit3 className="size-3" />
        </button>
        <button onClick={onDelete} className="size-7 sm:size-6 grid place-items-center bg-background/90 border border-border hover:text-destructive" aria-label="Eliminar">
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  );
}
