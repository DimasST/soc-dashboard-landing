"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function Pembayaran() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan");
  const price = searchParams.get("price");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const router = useRouter();

  const handleDummyPayment = () => {
    // Simulasi pembayaran sukses
    alert(`💳 Pembayaran paket ${plan} sebesar $${price} berhasil!`);
    setPaymentDone(true);
  };

  const handleSendInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("http://localhost:3001/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: plan || "User" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send invoice");

      alert("📩 Invoice & link aktivasi telah dikirim ke email Anda!");
      router.push(`/activate?token=${data.token}`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-[#0D1B2A] text-white min-h-screen flex flex-col justify-center items-center px-6">
      <h1 className="text-2xl font-bold mb-4">Pembayaran - {plan}</h1>
      <p className="mb-6">Total: ${price}</p>

      {!paymentDone ? (
        <button
          onClick={handleDummyPayment}
          className="px-6 py-3 bg-green-600 rounded hover:bg-green-500"
        >
          Bayar Sekarang
        </button>
      ) : (
        <form onSubmit={handleSendInvoice} className="w-full max-w-sm space-y-4 mt-6">
          <input
            type="email"
            placeholder="Masukkan email Anda"
            className="p-3 rounded w-full bg-[#0C1A2A] border border-gray-600"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 rounded hover:bg-blue-500"
          >
            {loading ? "Mengirim invoice..." : "Kirim Invoice"}
          </button>
        </form>
      )}
    </section>
  );
}
