import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Preekhulp — onderzoeksassistent",
  description: "Lokale onderzoeksassistent voor predikanten: exegese, bronnen, kritische toetsing. Geen preekschrijver.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <header className="kop">
          <div className="kop-binnen">
            <Link href="/" className="merk">Preekhulp<span>.</span></Link>
            <nav className="nav">
              <Link href="/">Onderzoek</Link>
              <Link href="/tekst">Tekst &amp; grondtaal</Link>
              <Link href="/bronnen">Bronnen</Link>
              <Link href="/bibliotheek">Eigen bibliotheek</Link>
              <Link href="/videos">Preken &amp; video</Link>
              <Link href="/projecten">Projecten</Link>
              <Link href="/instellingen">Instellingen</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
