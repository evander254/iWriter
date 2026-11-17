import { supabase } from "../lib/supabase";
import { unwrap, unwrapList } from "./api";
import type { Category, Subject } from "../types/models";

/* ---------------- Subjects ---------------- */

export async function listSubjects(): Promise<Subject[]> {
  const { data, error } = await supabase.from("subjects").select("*").order("name", { ascending: true });
  return unwrapList(data as Subject[] | null, error);
}

export async function createSubject(input: { name: string }): Promise<Subject> {
  const { data, error } = await supabase.from("subjects").insert({ name: input.name.trim() }).select("*").single();
  return unwrap(data as Subject | null, error, "subject");
}

export async function updateSubject(id: string, input: { name: string }): Promise<Subject> {
  const { data, error } = await supabase
    .from("subjects")
    .update({ name: input.name.trim() })
    .eq("id", id)
    .select("*")
    .single();
  return unwrap(data as Subject | null, error, "subject");
}

export async function deleteSubject(id: string): Promise<void> {
  const { error } = await supabase.from("subjects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------------- Categories ---------------- */

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from("categories").select("*").order("name", { ascending: true });
  return unwrapList(data as Category[] | null, error);
}

export async function createCategory(input: { name: string; description?: string | null }): Promise<Category> {
  const { data, error } = await supabase
    .from("categories")
    .insert({ name: input.name.trim(), description: input.description?.trim() || null })
    .select("*")
    .single();
  return unwrap(data as Category | null, error, "category");
}

export async function updateCategory(
  id: string,
  input: { name: string; description?: string | null },
): Promise<Category> {
  const { data, error } = await supabase
    .from("categories")
    .update({ name: input.name.trim(), description: input.description?.trim() || null })
    .eq("id", id)
    .select("*")
    .single();
  return unwrap(data as Category | null, error, "category");
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
