import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

/** Productpagina van Preekhulp. op denckh.nl. Tot die live staat: de homepage van Denckh. */
const DENCKH_URL = "https://denckh.nl/";

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
        <footer className="voet">
          <span>Preekhulp. — onderzoek, geen preek. Jij blijft eigenaar van uitleg en preek.</span>
          {/* Makersvermelding volgens DENCKH_MERKVERMELDING: officiële signatuur met krul, niet nagetekend. */}
          <a className="maker" href={DENCKH_URL} target="_blank" rel="noreferrer" aria-label="Ontwikkeld door Denckh (denckh.nl)">
            <span>Ontwikkeld door</span>
            <picture>
              <source srcSet="/brand/denckh-logo-signature-light.svg" media="(prefers-color-scheme: dark)" />
              <img src="/brand/denckh-logo-signature.svg" alt="Denckh." width={1000} height={302} />
            </picture>
          </a>
        </footer>
      </body>
    </html>
  );
}
