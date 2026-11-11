export * from "./database";

import type { Enums, Tables } from "./database";

export type Profile = Tables<"profiles">;
export type Work = Tables<"works">;
export type Edition = Tables<"editions">;
export type Author = Tables<"authors">;
export type Review = Tables<"reviews">;
export type UserBook = Tables<"user_books">;
export type Shelf = Tables<"shelves">;
export type Activity = Tables<"activities">;
export type Club = Tables<"clubs">;
export type Tag = Tables<"tags">;

export type ReadingStatus = Enums<"reading_status">;
export type EditionFormat = Enums<"edition_format">;
export type TagKind = Enums<"tag_kind">;
