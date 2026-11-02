# Maakt representatieve, zelfgeschreven testdocumenten (geen auteursrechtelijk materiaal).
# Gebruik: python3 tests/fixtures/maak-documenten.py   (vereist reportlab, python-docx, LibreOffice voor DOCX-voetnoten)
import os, subprocess, tempfile
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from docx import Document

UIT = os.path.join(os.path.dirname(__file__), "documenten")
os.makedirs(UIT, exist_ok=True)
W, H = A4

def tekst_pdf():
    c = canvas.Canvas(os.path.join(UIT, "tekst.pdf"), pagesize=A4)
    y = H - 72
    for r in ["Preekschets Genesis 31:13", "", "God zegt tegen Jakob: Ik ben de God van Betel.", "Zie ook Genesis 28:10-22 en Joh. 1:51.", "De gelofte van Jakob staat centraal (Gen 28:20)."]:
        c.drawString(72, y, r); y -= 18
    c.save()

def meerdere_paginas_pdf():
    c = canvas.Canvas(os.path.join(UIT, "meerdere-paginas.pdf"), pagesize=A4)
    for i, woord in enumerate(["laddervisioen", "huisgoden", "Pniël"], start=1):
        c.drawString(72, H - 72, f"Pagina {i}: over {woord}")
        c.drawString(72, H - 92, f"Dit stuk gaat over {woord} in de Jakobsverhalen.")
        c.showPage()
    c.save()

def voetnoten_pdf():
    c = canvas.Canvas(os.path.join(UIT, "voetnoten.pdf"), pagesize=A4)
    c.drawString(72, H - 72, "Rachel neemt de terafim mee.1 De tekst noemt haar motief niet.2")
    c.setFont("Helvetica", 8)
    c.drawString(72, 80, "1 Vergelijk Genesis 35:2-4, waar vreemde goden worden weggedaan.")
    c.drawString(72, 68, "2 Over de motieven bestaan verschillende verklaringen in de commentaren.")
    c.save()

def twee_kolommen_pdf():
    pad = os.path.join(UIT, "twee-kolommen.pdf")
    doc = BaseDocTemplate(pad, pagesize=A4)
    kol = (W - 72 * 2 - 18) / 2
    doc.addPageTemplates([PageTemplate(frames=[Frame(72, 72, kol, H - 144, id="l"), Frame(72 + kol + 18, 72, kol, H - 144, id="r")])])
    st = getSampleStyleSheet()["BodyText"]
    links = " ".join(["Linkerkolom over Betel en de zuil die Jakob oprichtte."] * 12)
    rechts = " ".join(["Rechterkolom over Laban en de steenhoop van Gilead."] * 12)
    doc.build([Paragraph("KOLOM-A " + links, st), Spacer(1, 400), Paragraph("KOLOM-B " + rechts, st)])

def scan_pdf():
    # Alleen een afbeelding, geen tekstlaag (zoals een gescande bladzijde).
    from reportlab.lib.utils import ImageReader
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (1200, 400), "white")
    ImageDraw.Draw(img).text((40, 40), "Gescande bladzijde over Genesis 31", fill="black")
    tmp = os.path.join(tempfile.gettempdir(), "scan.png"); img.save(tmp)
    c = canvas.Canvas(os.path.join(UIT, "scan.pdf"), pagesize=A4)
    c.drawImage(ImageReader(tmp), 72, H - 300, width=450, height=150)
    c.save()

def koppen_docx():
    d = Document()
    d.add_heading("Exegese Genesis 31", 1)
    d.add_paragraph("Inleiding over de terugkeer van Jakob (Gen 31:3).")
    d.add_heading("Betel", 2)
    d.add_paragraph("In Genesis 31:13 verwijst God naar Betel.")
    d.add_heading("Bibliografie", 2)
    for r in ["Calvijn, J. Commentaar op Genesis (1554).", "Henry, M. Commentary on the Whole Bible (1706)."]:
        d.add_paragraph(r, style="List Bullet")
    d.save(os.path.join(UIT, "koppen.docx"))

def tabel_docx():
    d = Document()
    d.add_paragraph("Overzicht van verzen")
    t = d.add_table(rows=3, cols=2)
    for i, (a, b) in enumerate([("Vers", "Onderwerp"), ("Gen 31:13", "God van Betel"), ("Gen 31:19", "Terafim gestolen")]):
        t.cell(i, 0).text, t.cell(i, 1).text = a, b
    d.save(os.path.join(UIT, "tabel.docx"))

def voetnoten_docx():
    # python-docx kan geen voetnoten maken: via een plat ODT-bestand en LibreOffice met echte voetnoten.
    fodt = """<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.text">
<office:body><office:text>
<text:p>Jakob richt een zuil op bij Betel.<text:note text:id="n1" text:note-class="footnote"><text:note-citation>1</text:note-citation><text:note-body><text:p>Voetnoot: de massebah keert terug in Genesis 35:14.</text:p></text:note-body></text:note></text:p>
</office:text></office:body></office:document>"""
    tmpd = tempfile.mkdtemp()
    src = os.path.join(tmpd, "voetnoten.fodt")
    open(src, "w").write(fodt)
    subprocess.run(["soffice", "--headless", "--convert-to", "docx", "--outdir", UIT, src], check=True, capture_output=True)

for f in [tekst_pdf, meerdere_paginas_pdf, voetnoten_pdf, twee_kolommen_pdf, scan_pdf, koppen_docx, tabel_docx, voetnoten_docx]:
    f()
print("klaar:", sorted(os.listdir(UIT)))
