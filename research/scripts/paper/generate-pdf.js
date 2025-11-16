#!/usr/bin/env node
/**
 * Generate PDF from Markdown with KaTeX math and syntax highlighting
 * Replaces pandoc-based PDF generation
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const katex = require('katex');
const hljs = require('highlight.js');
const puppeteer = require('puppeteer');

// Configure marked with syntax highlighting
marked.setOptions({
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (err) {
        console.error('Highlight error:', err);
      }
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: false,
  gfm: true,
});

// Preprocess markdown to convert math expressions
function preprocessMath(markdown) {
  // Convert display math $$...$$ to HTML with KaTeX
  markdown = markdown.replace(/\$\$([\s\S]+?)\$\$/g, (match, math) => {
    try {
      const html = katex.renderToString(math.trim(), {
        throwOnError: false,
        displayMode: true,
      });
      return `\n\n<div class="math-block">${html}</div>\n\n`;
    } catch (e) {
      console.error('KaTeX display math error:', e.message);
      return match;
    }
  });

  // Convert inline math $...$ to HTML with KaTeX (but not $$)
  markdown = markdown.replace(/(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g, (match, math) => {
    try {
      const html = katex.renderToString(math.trim(), {
        throwOnError: false,
        displayMode: false,
      });
      return html;
    } catch (e) {
      console.error('KaTeX inline math error:', e.message);
      return match;
    }
  });

  return markdown;
}

// HTML template with KaTeX and highlight.js CSS
const htmlTemplate = (title, content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css">
  <style>
    body {
      font-family: 'Georgia', serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      font-size: 11pt;
      color: #333;
    }
    h1 {
      font-size: 24pt;
      font-weight: bold;
      margin-top: 30px;
      margin-bottom: 20px;
      color: #000;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
    }
    h2 {
      font-size: 18pt;
      font-weight: bold;
      margin-top: 25px;
      margin-bottom: 15px;
      color: #000;
    }
    h3 {
      font-size: 14pt;
      font-weight: bold;
      margin-top: 20px;
      margin-bottom: 10px;
      color: #333;
    }
    h4 {
      font-size: 12pt;
      font-weight: bold;
      margin-top: 15px;
      margin-bottom: 10px;
      color: #333;
    }
    p {
      margin-bottom: 12px;
      text-align: justify;
    }
    code {
      font-family: 'Courier New', monospace;
      font-size: 10pt;
      background-color: #f5f5f5;
      padding: 2px 4px;
      border-radius: 3px;
    }
    pre {
      background-color: #f5f5f5;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
      margin: 15px 0;
      border: 1px solid #ddd;
    }
    pre code {
      background-color: transparent;
      padding: 0;
      font-size: 9pt;
      line-height: 1.4;
    }
    .math-block {
      margin: 20px 0;
      text-align: center;
      overflow-x: auto;
    }
    .katex {
      font-size: 1.1em;
    }
    .katex-display {
      margin: 1em 0;
    }
    blockquote {
      border-left: 4px solid #ddd;
      padding-left: 20px;
      margin-left: 0;
      color: #666;
      font-style: italic;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 20px 0;
      font-size: 10pt;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    ul, ol {
      margin: 10px 0;
      padding-left: 30px;
    }
    li {
      margin: 5px 0;
    }
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 20px auto;
    }
    @media print {
      body {
        max-width: none;
        padding: 0;
      }
      h1 {
        page-break-after: avoid;
      }
      h2, h3 {
        page-break-after: avoid;
      }
      pre, blockquote {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>
`;

async function generatePDF(inputMd, outputPdf) {
  console.log('📄 Generating PDF from Markdown...');
  console.log(`   Input: ${inputMd}`);
  console.log(`   Output: ${outputPdf}`);

  // Read markdown file
  const markdown = fs.readFileSync(inputMd, 'utf8');

  // Extract title from first # heading
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : 'Manuscript';

  // Preprocess math expressions
  console.log('   Processing math expressions with KaTeX...');
  const processedMarkdown = preprocessMath(markdown);

  // Convert markdown to HTML
  console.log('   Converting Markdown to HTML with syntax highlighting...');
  const htmlContent = marked.parse(processedMarkdown);
  const html = htmlTemplate(title, htmlContent);

  // Generate PDF with Puppeteer
  console.log('   Rendering PDF with Puppeteer...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
    ],
    timeout: 60000,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: outputPdf,
      format: 'Letter',
      margin: {
        top: '1in',
        right: '1in',
        bottom: '1in',
        left: '1in',
      },
      printBackground: true,
      preferCSSPageSize: false,
    });

    console.log('✅ PDF generated successfully!');
    const stats = fs.statSync(outputPdf);
    console.log(`   Size: ${(stats.size / 1024).toFixed(0)}KB`);
  } finally {
    await browser.close();
  }
}

// Main execution
const inputMd = path.join(__dirname, '../../paper/manuscript_v6.0.md');
const outputPdf = path.join(__dirname, '../../paper/manuscript_v6.0.pdf');

if (!fs.existsSync(inputMd)) {
  console.error('❌ Manuscript not found:', inputMd);
  process.exit(1);
}

generatePDF(inputMd, outputPdf)
  .then(() => {
    console.log('\n✅ PDF generation complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ PDF generation failed:', error);
    process.exit(1);
  });
