#!/usr/bin/env node
/**
 * Generate PDF from Markdown manuscript
 * Uses marked for Markdown parsing and Puppeteer for PDF generation
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer');

async function generatePDF(markdownFile, outputPDF) {
  try {
    // Read Markdown file
    const markdown = fs.readFileSync(markdownFile, 'utf-8');

    // Convert to HTML
    const html = marked.parse(markdown);

    // Create full HTML document with styling
    const fullHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 2em;
      font-size: 11pt;
    }
    h1 {
      border-bottom: 2px solid #eee;
      padding-bottom: 0.3em;
      font-size: 2em;
      margin-top: 1em;
    }
    h2 {
      border-bottom: 1px solid #eee;
      padding-bottom: 0.3em;
      font-size: 1.5em;
      margin-top: 1.5em;
    }
    h3 {
      font-size: 1.25em;
      margin-top: 1.25em;
    }
    code {
      background-color: #f6f8fa;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.9em;
    }
    pre {
      background-color: #f6f8fa;
      padding: 1em;
      border-radius: 5px;
      overflow-x: auto;
      page-break-inside: avoid;
    }
    pre code {
      background-color: transparent;
      padding: 0;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
      font-weight: bold;
    }
    blockquote {
      border-left: 4px solid #ddd;
      padding-left: 1em;
      margin-left: 0;
      color: #666;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    @media print {
      body {
        font-size: 10pt;
      }
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid;
      }
      pre, table, figure {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
${html}
</body>
</html>
    `;

    // Launch Puppeteer
    console.log('  Launching browser...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Set content
    console.log('  Rendering HTML...');
    await page.setContent(fullHTML, { waitUntil: 'networkidle0' });

    // Generate PDF
    console.log('  Generating PDF...');
    await page.pdf({
      path: outputPDF,
      format: 'A4',
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '20mm',
        right: '20mm',
      },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate:
        '<div style="font-size:10px;text-align:center;width:100%;margin:0 auto;padding-top:10px;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });

    await browser.close();

    console.log(`  SUCCESS: PDF saved to: ${path.basename(outputPDF)}`);
  } catch (error) {
    console.error('❌ Error generating PDF:', error.message);
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: generate-pdf.js <input.md> <output.pdf>');
  process.exit(1);
}

const [inputFile, outputFile] = args;
generatePDF(inputFile, outputFile);
