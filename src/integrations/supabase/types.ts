export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      categorias: {
        Row: {
          activo: boolean | null
          created_at: string | null
          descripcion: string | null
          id: number
          nombre: string
          orden: number | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          id?: never
          nombre: string
          orden?: number | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          id?: never
          nombre?: string
          orden?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      direcciones: {
        Row: {
          calle: string
          ciudad: string
          codigo_postal: string
          created_at: string
          etiqueta: string | null
          id: string
          numero: string | null
          piso: string | null
          predeterminada: boolean
          provincia: string
          telefono: string | null
          user_id: string
        }
        Insert: {
          calle: string
          ciudad: string
          codigo_postal: string
          created_at?: string
          etiqueta?: string | null
          id?: string
          numero?: string | null
          piso?: string | null
          predeterminada?: boolean
          provincia: string
          telefono?: string | null
          user_id: string
        }
        Update: {
          calle?: string
          ciudad?: string
          codigo_postal?: string
          created_at?: string
          etiqueta?: string | null
          id?: string
          numero?: string | null
          piso?: string | null
          predeterminada?: boolean
          provincia?: string
          telefono?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pedido_items: {
        Row: {
          cantidad: number
          id: string
          nombre: string
          pedido_id: string
          precio_unitario: number
          producto_id: number | null
          sku: string | null
          subtotal: number
          variante_id: number | null
        }
        Insert: {
          cantidad: number
          id?: string
          nombre: string
          pedido_id: string
          precio_unitario: number
          producto_id?: number | null
          sku?: string | null
          subtotal: number
          variante_id?: number | null
        }
        Update: {
          cantidad?: number
          id?: string
          nombre?: string
          pedido_id?: string
          precio_unitario?: number
          producto_id?: number | null
          sku?: string | null
          subtotal?: number
          variante_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_items_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_items_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          confirmation_email_sent_at: string | null
          costo_envio: number
          created_at: string
          direccion: Json | null
          email: string | null
          estado: Database["public"]["Enums"]["pedido_estado"]
          envio_metodo: Json | null
          envio_total: number
          id: string
          mp_payment_id: string | null
          mp_preference_id: string | null
          nombre: string | null
          notas: string | null
          shipping_option_id: string | null
          subtotal_productos: number
          telefono: string | null
          total: number
          transportista: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          confirmation_email_sent_at?: string | null
          costo_envio?: number
          created_at?: string
          direccion?: Json | null
          email?: string | null
          estado?: Database["public"]["Enums"]["pedido_estado"]
          envio_metodo?: Json | null
          envio_total?: number
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          nombre?: string | null
          notas?: string | null
          shipping_option_id?: string | null
          subtotal_productos?: number
          telefono?: string | null
          total?: number
          transportista?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          confirmation_email_sent_at?: string | null
          costo_envio?: number
          created_at?: string
          direccion?: Json | null
          email?: string | null
          estado?: Database["public"]["Enums"]["pedido_estado"]
          envio_metodo?: Json | null
          envio_total?: number
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          nombre?: string | null
          notas?: string | null
          shipping_option_id?: string | null
          subtotal_productos?: number
          telefono?: string | null
          total?: number
          transportista?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_shipping_option_id_fkey"
            columns: ["shipping_option_id"]
            isOneToOne: false
            referencedRelation: "shipping_options"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_options: {
        Row: {
          activo: boolean
          costo: number
          created_at: string
          dias_estimados_max: number | null
          dias_estimados_min: number | null
          id: string
          label: string
          provincia: string | null
          transportista: Database["public"]["Enums"]["transportista"]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          costo?: number
          created_at?: string
          dias_estimados_max?: number | null
          dias_estimados_min?: number | null
          id?: string
          label: string
          provincia?: string | null
          transportista: Database["public"]["Enums"]["transportista"]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          costo?: number
          created_at?: string
          dias_estimados_max?: number | null
          dias_estimados_min?: number | null
          id?: string
          label?: string
          provincia?: string | null
          transportista?: Database["public"]["Enums"]["transportista"]
          updated_at?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt: string | null
          created_at: string
          id: string
          orden: number
          producto_id: number
          url: string | null
          url_webp: string | null
        }
        Insert: {
          alt?: string | null
          created_at?: string
          id?: string
          orden?: number
          producto_id: number
          url?: string | null
          url_webp?: string | null
        }
        Update: {
          alt?: string | null
          created_at?: string
          id?: string
          orden?: number
          producto_id?: number
          url?: string | null
          url_webp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean
          categoria: string | null
          codigo_fabricante: string | null
          descripcion: string | null
          erp_updated_at: string | null
          grupo: string | null
          id: number
          image_url: string | null
          image_webp: string | null
          last_import_id: string | null
          nombre: string | null
          oferta_hasta: string | null
          precio: number | null
          precio_vta_sin_iva: number | null
          precio_oferta: number | null
          sku: string | null
          stock: number | null
        }
        Insert: {
          activo?: boolean
          categoria?: string | null
          codigo_fabricante?: string | null
          descripcion?: string | null
          erp_updated_at?: string | null
          grupo?: string | null
          id?: never
          image_url?: string | null
          image_webp?: string | null
          last_import_id?: string | null
          nombre?: string | null
          oferta_hasta?: string | null
          precio?: number | null
          precio_vta_sin_iva?: number | null
          precio_oferta?: number | null
          sku?: string | null
          stock?: number | null
        }
        Update: {
          activo?: boolean
          categoria?: string | null
          codigo_fabricante?: string | null
          descripcion?: string | null
          erp_updated_at?: string | null
          grupo?: string | null
          id?: never
          image_url?: string | null
          image_webp?: string | null
          last_import_id?: string | null
          nombre?: string | null
          oferta_hasta?: string | null
          precio?: number | null
          precio_vta_sin_iva?: number | null
          precio_oferta?: number | null
          sku?: string | null
          stock?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          dni: string | null
          email_canonical: string | null
          id: string
          nombre: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dni?: string | null
          email_canonical?: string | null
          id: string
          nombre?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dni?: string | null
          email_canonical?: string | null
          id?: string
          nombre?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      variantes: {
        Row: {
          descripcion_presentacion: string | null
          id: number
          nombre_presentacion: string | null
          precio: number | null
          producto_id: number | null
          sku: string | null
          stock: number | null
        }
        Insert: {
          descripcion_presentacion?: string | null
          id?: never
          nombre_presentacion?: string | null
          precio?: number | null
          producto_id?: number | null
          sku?: string | null
          stock?: number | null
        }
        Update: {
          descripcion_presentacion?: string | null
          id?: never
          nombre_presentacion?: string | null
          precio?: number | null
          producto_id?: number | null
          sku?: string | null
          stock?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "variantes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      pedido_estado:
        | "pendiente"
        | "pagado"
        | "enviado"
        | "entregado"
        | "cancelado"
      transportista:
        | "correo_argentino"
        | "andreani"
        | "cadete"
        | "retiro_local"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      pedido_estado: [
        "pendiente",
        "pagado",
        "enviado",
        "entregado",
        "cancelado",
      ],
      transportista: [
        "correo_argentino",
        "andreani",
        "cadete",
        "retiro_local",
      ],
    },
  },
} as const
