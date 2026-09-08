"use client";

import { useState } from "react";

type Result =
  | { ok: true; fileId: string; filename: string; contentType: string; reportedSize: string; firstBytesRead: number }
  | { ok?: false; error: string; fileId?: string };

export default function TestDrivePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/daily/test-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveUrl: url }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ error: (err as Error)?.message ?? "שגיאה לא ידועה" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-8 font-sans text-right" dir="rtl">
      <h1 className="mb-6 text-xl font-bold">בדיקת הורדה מ-Google Drive</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-600">
            קישור Google Drive
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://drive.google.com/file/d/..."
            dir="ltr"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="w-full rounded-full bg-blue-600 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? "מוריד..." : "בדיקה"}
        </button>
      </form>

      {result && (
        <div className={`mt-6 rounded-xl p-4 text-sm ${result.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"}`}>
          {result.ok ? (
            <dl className="space-y-1">
              <div><dt className="inline font-bold">סטטוס: </dt><dd className="inline">✅ הצלחה</dd></div>
              <div><dt className="inline font-bold">מזהה קובץ: </dt><dd className="inline font-mono text-xs">{result.fileId}</dd></div>
              <div><dt className="inline font-bold">שם קובץ: </dt><dd className="inline">{result.filename}</dd></div>
              <div><dt className="inline font-bold">סוג: </dt><dd className="inline">{result.contentType}</dd></div>
              <div><dt className="inline font-bold">גודל (Content-Length): </dt><dd className="inline">{result.reportedSize}</dd></div>
              <div><dt className="inline font-bold">בייטים שהתקבלו: </dt><dd className="inline">{result.firstBytesRead.toLocaleString()}</dd></div>
            </dl>
          ) : (
            <p><span className="font-bold">שגיאה:</span> {result.error}</p>
          )}
        </div>
      )}
    </main>
  );
}
