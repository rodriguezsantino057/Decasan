# Plan: Selección múltiple + Galería multi-imagen + Editor de recorte

Tres bloques grandes. Te propongo el orden y el alcance antes de tocar nada, porque varios cambios son irreversibles (migración de DB, storage) y otros tocan archivos críticos del admin.

---

## Bloque 1 — Selección múltiple y acciones masivas en Admin

### Cambios de DB
- Agregar `productos.activo boolean default true` (estado activo/inactivo).
- Agregar `productos.precio_oferta numeric` y `productos.oferta_hasta timestamptz` (descuentos programables).
- Índice en `activo` para filtros.

### Frontend (`_authenticated.admin.productos.tsx`)
- Columna de checkbox + "seleccionar todos" (de la página actual).
- `Set<number>` de IDs seleccionados en estado, persistido entre cambios de página/búsqueda/filtros (no se limpia al re-fetch).
- Barra flotante de acciones masivas (visible cuando `selected.size > 0`) con:
  - Cambiar categoría / grupo
  - Activar / desactivar
  - Ajuste de precio por porcentaje (+/- %)
  - Set de stock absoluto o delta
  - Crear oferta (precio_oferta + fecha límite)
  - Eliminar
- `AlertDialog` de confirmación con resumen ("Se actualizarán N productos") para acciones destructivas/precio.

### Backend (`src/lib/admin.functions.ts`)
- `adminBulkUpdateProductos` con discriminated union validada con Zod:
  - `{ action: "set_categoria", ids, categoria }`
  - `{ action: "set_grupo", ids, grupo }`
  - `{ action: "set_activo", ids, activo }`
  - `{ action: "adjust_precio_pct", ids, pct }` (clamp >= 0)
  - `{ action: "set_stock", ids, stock }` (>= 0)
  - `{ action: "set_oferta", ids, precio_oferta, oferta_hasta }`
  - `{ action: "delete", ids }`
- Límite máximo: 500 ids por llamada.
- Para ajuste de precio: hacer `UPDATE ... SET precio = round(precio * (1 + pct/100), 2)` vía RPC (no traer y reinsertar). Si no se puede en una sola query desde supabase-js, hacer batch SELECT + UPDATE por id en transacción lógica.

---

## Bloque 2 — Múltiples imágenes por producto

### Cambios de DB
Nueva tabla `product_images`:
```
id uuid pk, producto_id bigint fk productos(id) on delete cascade,
url text, url_webp text, alt text, orden int default 0,
created_at timestamptz default now()
```
- Índice `(producto_id, orden)`.
- RLS: lectura pública, escritura solo admin (vía `has_role`).
- **Migración de datos**: si `productos.image_url` o `image_webp` existen, insertar como `orden = 0` en `product_images` para mantener compatibilidad.
- Mantener columnas `image_url`/`image_webp` en `productos` por ahora como cache de "imagen principal" (la de orden 0). Un trigger las sincroniza cuando cambia la imagen orden 0.

### Backend
- `fetchProducto(id)` también trae `product_images` ordenadas.
- `fetchProductos` sigue usando `image_url`/`image_webp` (el cache) para listas → cero impacto en performance del catálogo.
- `adminProductImages` server fns: `list`, `add` (url, url_webp, orden), `reorder` (array de `{id, orden}`), `delete`, `setPrincipal`.

### Frontend
- **Detalle de producto** (`productos.$id.tsx`): galería con miniaturas + imagen grande, click en thumbnail cambia la principal, navegación con flechas. Lazy loading nativo + `<picture>` con webp.
- **ProductCard / búsqueda / destacados**: siguen usando `image_url`/`image_webp` (la principal). Sin cambios visuales.
- **Admin productos detalle**: nueva sección "Galería" con grilla drag & drop (uso `@dnd-kit/sortable`), botón "Subir imágenes" (multi-file), borrar, marcar como principal.

---

## Bloque 3 — Editor de recorte + normalización al subir

### Frontend
- Librería: `react-easy-crop` (ligera, sin dependencias nativas, funciona en browser).
- Flujo al subir cualquier imagen (single o batch):
  1. Usuario selecciona archivo(s).
  2. Modal con cropper, aspect ratio fijo **1:1** (configurable luego), preview en tiempo real.
  3. Al confirmar, recorte se renderiza en `<canvas>`, se exporta a **WebP** con `canvas.toBlob(_, 'image/webp', 0.85)`.
  4. Se redimensiona a un tamaño máximo (ej. 1200x1200) antes de exportar.
  5. Si el browser no soporta encode WebP (Safari viejo), fallback a JPEG.
  6. Upload del blob resultante a Supabase Storage `product-images/<producto_id>/<uuid>.webp`.
- Para imágenes ya cargadas: botón "Editar recorte" en la galería abre el mismo modal cargando la URL existente.

### Consistencia visual
- `<ProductImage>` ya usa `<picture>`. Agregar `object-cover` + `aspect-square` en contenedores de catálogo/sliders → todas las cards uniformes incluso si alguna imagen vieja no respeta el ratio.

### Sin server-side processing
- El runtime Worker no soporta `sharp`. Todo el procesamiento (resize, crop, encode WebP) ocurre en el browser antes de subir. Documentado en código.

---

## Orden de ejecución sugerido

1. **Migración DB**: `activo`, `precio_oferta`, `oferta_hasta`, tabla `product_images` + RLS + backfill desde `image_url`.
2. **Bloque 1** (selección múltiple + bulk actions) — independiente, valor inmediato.
3. **Bloque 2** (galería) — depende de la migración.
4. **Bloque 3** (cropper) — se integra encima del uploader del Bloque 2.

## Preguntas antes de avanzar

1. **Aspect ratio del cropper**: ¿1:1 (cuadrado, ideal para ecommerce uniforme), 4:3, o configurable por producto?
2. **Estado activo/inactivo**: ¿los inactivos no se muestran en el catálogo público o solo se marcan visualmente en admin?
3. **Ofertas programables**: ¿el precio efectivo lo calcula el frontend (`oferta_hasta > now() ? precio_oferta : precio`) o querés un campo computado?
4. ¿Arranco con los 3 bloques en orden o preferís que entregue solo el Bloque 1 primero para validar el patrón?
