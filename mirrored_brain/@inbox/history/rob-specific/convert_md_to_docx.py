import markdown
from htmldocx import HtmlToDocx
import sys
import os

def convert_md_to_docx(md_path, docx_path):
    # Read Markdown content
    with open(md_path, 'r', encoding='utf-8') as f:
        md_text = f.read()

    # Convert Markdown to HTML
    # We use extra extensions for tables, etc.
    html_text = markdown.markdown(md_text, extensions=['extra'])

    # Create a new Word document
    from docx import Document
    doc = Document()

    # Convert HTML to DOCX
    new_parser = HtmlToDocx()
    new_parser.add_html_to_document(html_text, doc)

    # Save the document
    doc.save(docx_path)

    print(f"Successfully converted {md_path} to {docx_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python convert_md_to_docx.py <input_md_file> [output_docx_file]")
        sys.exit(1)

    input_md = sys.argv[1]
    if len(sys.argv) > 2:
        output_docx = sys.argv[2]
    else:
        output_docx = os.path.splitext(input_md)[0] + ".docx"

    convert_md_to_docx(input_md, output_docx)
