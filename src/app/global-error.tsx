"use client";

// Replaces the root layout when it fails, so it brings its own <html>, <body>
// and inline styles: the app's stylesheet is not loaded here.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#f8faf9",
          color: "#14201a",
        }}
      >
        <main style={{ maxWidth: 360, margin: "0 auto", padding: "64px 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: "0 0 12px" }}>Something went wrong</h1>
          <p style={{ fontSize: 15, lineHeight: 1.5, margin: "0 0 20px" }}>
            Nothing you saved was lost. Check your connection and try again.
          </p>
          <button
            onClick={() => retry()}
            style={{
              height: 48,
              width: "100%",
              borderRadius: 12,
              border: "none",
              background: "#1f7a4d",
              color: "#ffffff",
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
