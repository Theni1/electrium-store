import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import ProductForm from "./ProductForm";

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

  const { data: bikes } = await supabase
    .from("bikes")
    .select("bike_id, name, image, amount_stocked, sell_price, rental_rate, for_rent")
    .order("bike_id");

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] px-6 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="text-3xl font-bold text-[hsl(var(--text-primary))] mb-8 text-center">
          Admin
        </h1>

        <section className="mb-12 flex flex-col items-center">
          <h2 className="text-xl font-semibold text-[hsl(var(--text-primary))] mb-4">
            Add a product
          </h2>
          <ProductForm />
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[hsl(var(--text-primary))] mb-4 text-center">
            Products ({bikes?.length ?? 0})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-[hsl(var(--text-primary))]">
            <thead className="text-[hsl(var(--text-secondary))]">
              <tr>
                <th className="text-left p-2">ID</th>
                <th className="text-left p-2">Image</th>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Stock</th>
                <th className="text-left p-2">Sell</th>
                <th className="text-left p-2">Rental</th>
                <th className="text-left p-2">Rental default</th>
              </tr>
            </thead>
            <tbody>
              {bikes?.map((bike) => (
                <tr key={bike.bike_id} className="border-t border-[hsl(var(--border))]">
                  <td className="p-2">{bike.bike_id}</td>
                  <td className="p-2">
                    {bike.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={bike.image}
                        alt={bike.name}
                        className="w-12 h-12 object-contain"
                      />
                    ) : (
                      <span className="text-[hsl(var(--text-muted))]">none</span>
                    )}
                  </td>
                  <td className="p-2">{bike.name}</td>
                  <td className="p-2">{bike.amount_stocked}</td>
                  <td className="p-2">${bike.sell_price}</td>
                  <td className="p-2">${bike.rental_rate}</td>
                  <td className="p-2">{bike.for_rent ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
