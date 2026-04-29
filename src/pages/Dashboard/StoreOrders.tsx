import React, { useState } from "react";
import { api } from "../../api/client";
import { Package, Truck, CheckCircle2, Loader2, Search } from "lucide-react";
import { format } from "date-fns";

export const StoreOrders: React.FC = () => {
  const { data, isLoading, refetch } = api.store.getOrders.useQuery();
  const updateStatus = api.store.updateOrderStatus.useMutation();
  const [filter, setFilter] = useState<"all" | "unfulfilled" | "fulfilled">("all");
  const [search, setSearch] = useState("");

  const handleToggleStatus = async (orderId: string, currentStatus: string | null) => {
    const newStatus = currentStatus === "fulfilled" ? "unfulfilled" : "fulfilled";
    await updateStatus.mutateAsync({
      params: { id: orderId },
      body: { fulfillment_status: newStatus }
    });
    refetch();
  };

  const orders = data?.body || [];
  const filteredOrders = orders.filter(o => {
    if (filter !== "all" && o.fulfillment_status !== filter) return false;
    if (search && !o.customer_email?.toLowerCase().includes(search.toLowerCase()) && !o.id.includes(search)) return false;
    return true;
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="text-ares-gold w-6 h-6" />
            Store Orders
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Manage physical merchandise fulfillment and tracking.</p>
        </div>
      </div>

      <div className="bg-obsidian border border-white/10 rounded-xl overflow-hidden flex flex-col h-full shadow-xl">
        <div className="p-4 border-b border-white/10 bg-white/5 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search email or order ID..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-ares-gold focus:outline-none transition-colors w-64"
              />
            </div>
            
            <div className="flex bg-black/50 border border-white/10 rounded-lg p-1">
              <button 
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${filter === "all" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}
              >
                All
              </button>
              <button 
                onClick={() => setFilter("unfulfilled")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${filter === "unfulfilled" ? "bg-ares-red/20 text-ares-red" : "text-slate-400 hover:text-white"}`}
              >
                Unfulfilled
              </button>
              <button 
                onClick={() => setFilter("fulfilled")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${filter === "fulfilled" ? "bg-green-500/20 text-green-400" : "text-slate-400 hover:text-white"}`}
              >
                Fulfilled
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-12 flex justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-ares-gold" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              No orders found matching the current filters.
            </div>
          ) : (
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-white/5 text-xs uppercase text-slate-400 font-bold sticky top-0 backdrop-blur-md">
                <tr>
                  <th className="px-6 py-4">Order Details</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Shipping Address</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs text-slate-500 truncate w-32" title={order.id}>{order.id.split('-').pop()}</div>
                      <div className="text-xs mt-1">{order.created_at ? format(new Date(order.created_at), "MMM d, yyyy h:mm a") : "Unknown Date"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{order.shipping_name || "Unknown"}</div>
                      <div className="text-slate-400 text-xs">{order.customer_email || "No email"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-slate-400 max-w-[200px]">
                        {order.shipping_address_line1} {order.shipping_address_line2}
                        <br />
                        {order.shipping_city}, {order.shipping_state} {order.shipping_postal_code}
                        <br />
                        {order.shipping_country}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-ares-gold font-bold">
                        ${(order.total_cents / 100).toFixed(2)}
                      </div>
                      <div className="text-xs uppercase bg-white/10 px-2 py-0.5 rounded-full inline-block mt-1">
                        {order.status}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {order.fulfillment_status === "fulfilled" ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-green-400 bg-green-500/10 px-3 py-1 rounded-full w-max border border-green-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Fulfilled
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-ares-red bg-ares-red/10 px-3 py-1 rounded-full w-max border border-ares-red/20">
                          <Truck className="w-3 h-3" /> Unfulfilled
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleToggleStatus(order.id, order.fulfillment_status)}
                        disabled={updateStatus.isPending}
                        className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 text-white transition-colors disabled:opacity-50"
                      >
                        {order.fulfillment_status === "fulfilled" ? "Mark Unfulfilled" : "Mark Fulfilled"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoreOrders;
