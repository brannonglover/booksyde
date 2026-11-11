// Generated from supabase/migrations. Regenerate with `npm run db:types`
// (runs `supabase gen types typescript --local`) once Supabase is running.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: {
          actor_id: string
          created_at: string
          id: number
          metadata: Json
          review_id: string | null
          target_user_id: string | null
          verb: Database["public"]["Enums"]["activity_verb"]
          work_id: string | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: never
          metadata?: Json
          review_id?: string | null
          target_user_id?: string | null
          verb: Database["public"]["Enums"]["activity_verb"]
          work_id?: string | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: never
          metadata?: Json
          review_id?: string | null
          target_user_id?: string | null
          verb?: Database["public"]["Enums"]["activity_verb"]
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      authors: {
        Row: {
          bio: string | null
          birth_date: string | null
          created_at: string
          death_date: string | null
          id: string
          name: string
          open_library_id: string | null
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          death_date?: string | null
          id?: string
          name: string
          open_library_id?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          death_date?: string | null
          id?: string
          name?: string
          open_library_id?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      club_members: {
        Row: {
          club_id: string
          joined_at: string
          role: Database["public"]["Enums"]["club_role"]
          user_id: string
        }
        Insert: {
          club_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["club_role"]
          user_id: string
        }
        Update: {
          club_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["club_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_posts: {
        Row: {
          body: string
          club_id: string
          club_read_id: string | null
          created_at: string
          id: string
          spoiler_page: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          club_id: string
          club_read_id?: string | null
          created_at?: string
          id?: string
          spoiler_page?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          body?: string
          club_id?: string
          club_read_id?: string | null
          created_at?: string
          id?: string
          spoiler_page?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_posts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_posts_club_read_id_fkey"
            columns: ["club_read_id"]
            isOneToOne: false
            referencedRelation: "club_reads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_reads: {
        Row: {
          club_id: string
          created_at: string
          ends_on: string | null
          id: string
          starts_on: string | null
          work_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          ends_on?: string | null
          id?: string
          starts_on?: string | null
          work_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          ends_on?: string | null
          id?: string
          starts_on?: string | null
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_reads_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_reads_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          cover_color: string | null
          created_at: string
          description: string | null
          id: string
          is_private: boolean
          name: string
          owner_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          cover_color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_private?: boolean
          name: string
          owner_id?: string
          slug: string
          updated_at?: string
        }
        Update: {
          cover_color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_private?: boolean
          name?: string
          owner_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clubs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      editions: {
        Row: {
          audio_minutes: number | null
          cover_url: string | null
          created_at: string
          format: Database["public"]["Enums"]["edition_format"]
          id: string
          isbn_10: string | null
          isbn_13: string | null
          language: string | null
          open_library_id: string | null
          page_count: number | null
          published_date: string | null
          publisher: string | null
          title: string | null
          updated_at: string
          work_id: string
        }
        Insert: {
          audio_minutes?: number | null
          cover_url?: string | null
          created_at?: string
          format?: Database["public"]["Enums"]["edition_format"]
          id?: string
          isbn_10?: string | null
          isbn_13?: string | null
          language?: string | null
          open_library_id?: string | null
          page_count?: number | null
          published_date?: string | null
          publisher?: string | null
          title?: string | null
          updated_at?: string
          work_id: string
        }
        Update: {
          audio_minutes?: number | null
          cover_url?: string | null
          created_at?: string
          format?: Database["public"]["Enums"]["edition_format"]
          id?: string
          isbn_10?: string | null
          isbn_13?: string | null
          language?: string | null
          open_library_id?: string | null
          page_count?: number | null
          published_date?: string | null
          publisher?: string | null
          title?: string | null
          updated_at?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "editions_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          status: Database["public"]["Enums"]["follow_status"]
        }
        Insert: {
          created_at?: string
          follower_id?: string
          following_id: string
          status?: Database["public"]["Enums"]["follow_status"]
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          status?: Database["public"]["Enums"]["follow_status"]
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          followers_count: number
          following_count: number
          id: string
          is_private: boolean
          role: Database["public"]["Enums"]["user_role"]
          theme_color: string | null
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          followers_count?: number
          following_count?: number
          id: string
          is_private?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          theme_color?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          followers_count?: number
          following_count?: number
          id?: string
          is_private?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          theme_color?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      reading_sessions: {
        Row: {
          created_at: string
          current_page: number | null
          edition_id: string | null
          finished_at: string | null
          id: string
          percent: number | null
          started_at: string
          updated_at: string
          user_id: string
          work_id: string
        }
        Insert: {
          created_at?: string
          current_page?: number | null
          edition_id?: string | null
          finished_at?: string | null
          id?: string
          percent?: number | null
          started_at?: string
          updated_at?: string
          user_id: string
          work_id: string
        }
        Update: {
          created_at?: string
          current_page?: number | null
          edition_id?: string | null
          finished_at?: string | null
          id?: string
          percent?: number | null
          started_at?: string
          updated_at?: string
          user_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_sessions_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_sessions_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      review_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          parent_id: string | null
          review_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          review_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          review_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "review_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_comments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_likes: {
        Row: {
          created_at: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          review_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_likes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string | null
          comments_count: number
          created_at: string
          edition_id: string | null
          has_spoilers: boolean
          id: string
          likes_count: number
          rating: number | null
          updated_at: string
          user_id: string
          work_id: string
        }
        Insert: {
          body?: string | null
          comments_count?: number
          created_at?: string
          edition_id?: string | null
          has_spoilers?: boolean
          id?: string
          likes_count?: number
          rating?: number | null
          updated_at?: string
          user_id?: string
          work_id: string
        }
        Update: {
          body?: string | null
          comments_count?: number
          created_at?: string
          edition_id?: string | null
          has_spoilers?: boolean
          id?: string
          likes_count?: number
          rating?: number | null
          updated_at?: string
          user_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      series_works: {
        Row: {
          position: number | null
          series_id: string
          work_id: string
        }
        Insert: {
          position?: number | null
          series_id: string
          work_id: string
        }
        Update: {
          position?: number | null
          series_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_works_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_works_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      shelf_items: {
        Row: {
          added_at: string
          position: number
          shelf_id: string
          work_id: string
        }
        Insert: {
          added_at?: string
          position?: number
          shelf_id: string
          work_id: string
        }
        Update: {
          added_at?: string
          position?: number
          shelf_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shelf_items_shelf_id_fkey"
            columns: ["shelf_id"]
            isOneToOne: false
            referencedRelation: "shelves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_items_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      shelves: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          emoji: string | null
          id: string
          is_public: boolean
          name: string
          position: number
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          is_public?: boolean
          name: string
          position?: number
          slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          is_public?: boolean
          name?: string
          position?: number
          slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shelves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tag_votes: {
        Row: {
          created_at: string
          tag_id: string
          user_id: string
          work_id: string
        }
        Insert: {
          created_at?: string
          tag_id: string
          user_id?: string
          work_id: string
        }
        Update: {
          created_at?: string
          tag_id?: string
          user_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_votes_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_votes_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          id: string
          kind: Database["public"]["Enums"]["tag_kind"]
          name: string
          slug: string
        }
        Insert: {
          id?: string
          kind: Database["public"]["Enums"]["tag_kind"]
          name: string
          slug: string
        }
        Update: {
          id?: string
          kind?: Database["public"]["Enums"]["tag_kind"]
          name?: string
          slug?: string
        }
        Relationships: []
      }
      user_books: {
        Row: {
          created_at: string
          edition_id: string | null
          finished_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["reading_status"]
          updated_at: string
          user_id: string
          work_id: string
        }
        Insert: {
          created_at?: string
          edition_id?: string | null
          finished_at?: string | null
          started_at?: string | null
          status: Database["public"]["Enums"]["reading_status"]
          updated_at?: string
          user_id: string
          work_id: string
        }
        Update: {
          created_at?: string
          edition_id?: string | null
          finished_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["reading_status"]
          updated_at?: string
          user_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_books_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_books_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_books_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      work_contributors: {
        Row: {
          author_id: string
          position: number
          role: Database["public"]["Enums"]["contributor_role"]
          work_id: string
        }
        Insert: {
          author_id: string
          position?: number
          role?: Database["public"]["Enums"]["contributor_role"]
          work_id: string
        }
        Update: {
          author_id?: string
          position?: number
          role?: Database["public"]["Enums"]["contributor_role"]
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_contributors_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_contributors_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      work_tags: {
        Row: {
          tag_id: string
          votes: number
          work_id: string
        }
        Insert: {
          tag_id: string
          votes?: number
          work_id: string
        }
        Update: {
          tag_id?: string
          votes?: number
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tags_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      works: {
        Row: {
          avg_rating: number
          cover_color: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          embedding: string | null
          first_published_year: number | null
          id: string
          open_library_id: string | null
          original_language: string | null
          ratings_count: number
          reviews_count: number
          search: unknown | null
          shelved_count: number
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          avg_rating?: number
          cover_color?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          embedding?: string | null
          first_published_year?: number | null
          id?: string
          open_library_id?: string | null
          original_language?: string | null
          ratings_count?: number
          reviews_count?: number
          search?: never
          shelved_count?: number
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          avg_rating?: number
          cover_color?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          embedding?: string | null
          first_published_year?: number | null
          id?: string
          open_library_id?: string | null
          original_language?: string | null
          ratings_count?: number
          reviews_count?: number
          search?: never
          shelved_count?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_user: { Args: { target: string }; Returns: boolean }
      get_feed: {
        Args: { max_results?: number; before?: string }
        Returns: Database["public"]["Tables"]["activities"]["Row"][]
      }
      is_club_admin: { Args: { p_club_id: string }; Returns: boolean }
      is_club_member: { Args: { p_club_id: string }; Returns: boolean }
      is_librarian: { Args: Record<PropertyKey, never>; Returns: boolean }
      search_works: {
        Args: { q: string; max_results?: number }
        Returns: Database["public"]["Tables"]["works"]["Row"][]
      }
      similar_works: {
        Args: { p_work_id: string; max_results?: number }
        Returns: Database["public"]["Tables"]["works"]["Row"][]
      }
    }
    Enums: {
      activity_verb: "shelved" | "started" | "finished" | "dnf" | "rated" | "reviewed" | "followed"
      club_role: "owner" | "moderator" | "member"
      contributor_role: "author" | "translator" | "illustrator" | "editor" | "narrator"
      edition_format: "hardcover" | "paperback" | "mass_market" | "ebook" | "audiobook" | "other"
      follow_status: "pending" | "accepted"
      reading_status: "want_to_read" | "reading" | "read" | "did_not_finish"
      tag_kind: "genre" | "mood" | "trope" | "pace" | "content_warning"
      user_role: "member" | "librarian" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];

export const Constants = {
  public: {
    Enums: {
      activity_verb: ["shelved", "started", "finished", "dnf", "rated", "reviewed", "followed"],
      club_role: ["owner", "moderator", "member"],
      contributor_role: ["author", "translator", "illustrator", "editor", "narrator"],
      edition_format: ["hardcover", "paperback", "mass_market", "ebook", "audiobook", "other"],
      follow_status: ["pending", "accepted"],
      reading_status: ["want_to_read", "reading", "read", "did_not_finish"],
      tag_kind: ["genre", "mood", "trope", "pace", "content_warning"],
      user_role: ["member", "librarian", "admin"],
    },
  },
} as const;
