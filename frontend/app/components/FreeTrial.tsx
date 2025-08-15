"use client";

import { useState } from "react";

export default function FreeTrial() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("http://localhost:3001/api/free-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setMessage("✅ Invitation sent! Check your email.");
      setEmail("");
    } catch (error: any) {
      setMessage("❌ " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="freetrial"
      className="bg-[#0D1B2A] text-white py-20 px-6 text-center"
    >
      <h2 className="text-2xl font-bold mb-6">Free Trial - 5 Minutes</h2>
      <div className="text-gray-300 mb-6">
        <ul className="space-y-1">
          <li>• Full access for 5 Minutes</li>
          <li>• 100% free, no credit card required</li>
          <li>• No commitment</li>
          <li>• Free version available after trial</li>
        </ul>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col md:flex-row justify-center gap-4 max-w-xl mx-auto"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your Email"
          required
          className="p-3 rounded w-full md:w-auto flex-1 bg-[#0C1A2A] border border-gray-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className={`px-6 py-3 rounded transition ${
            loading
              ? "bg-gray-600 text-gray-300 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-500 text-white"
          }`}
        >
          {loading ? "Sending..." : "Get Trial"}
        </button>
      </form>

      {message && (
        <p
          className={`mt-4 text-sm ${
            message.startsWith("✅") ? "text-green-400" : "text-red-400"
          }`}
        >
          {message}
        </p>
      )}
    </section>
  );
}
