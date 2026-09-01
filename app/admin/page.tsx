import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!customer?.is_admin) {
    redirect("/");
  }

  return <div className="min-h-screen bg-[hsl(var(--background))]" />;
}
