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

    // Get the directory of the markdown file for resolving relative paths
    const markdownDir = path.dirname(path.resolve(markdownFile));
    
    // Convert images to base64 and embed directly
    let processedHtml = html;
    const imageRegex = /src="figures\/([^"]+)"/g;
    let match;
    let imageCount = 0;
    
    while ((match = imageRegex.exec(html)) !== null) {
      const imageName = match[1];
      const imagePath = path.join(markdownDir, 'figures', imageName);
      
      try {
        if (fs.existsSync(imagePath)) {
          const imageData = fs.readFileSync(imagePath);
          const base64Image = imageData.toString('base64');
          const ext = path.extname(imageName).substring(1);
          const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
          const dataUrl = `data:${mimeType};base64,${base64Image}`;
          
          processedHtml = processedHtml.replace(
            `src="figures/${imageName}"`,
            `src="${dataUrl}"`
          );
          imageCount++;
          console.log(`  ✓ Embedded image: ${imageName}`);
        } else {
          console.warn(`  ⚠ Image not found: ${imagePath}`);
        }
      } catch (err) {
        console.warn(`  ⚠ Failed to load image ${imageName}: ${err.message}`);
      }
    }
    
    console.log(`  ✓ Total images embedded: ${imageCount}`);

    // Create full HTML document with styling and MathJax
    const fullHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
  <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
  <script>
    MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
        displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']]
      },
      svg: {
        fontCache: 'global'
      }
    };
  </script>
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
      display: block;
      margin: 1em auto;
    }
    figure {
      text-align: center;
      margin: 1.5em 0;
      page-break-inside: avoid;
    }
    figcaption, em {
      font-style: italic;
      color: #666;
      font-size: 0.9em;
      margin-top: 0.5em;
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
${processedHtml}
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
    await page.setContent(fullHTML, { 
      waitUntil: ['load', 'domcontentloaded', 'networkidle0'] 
    });
    
    // Wait for images to load
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.images)
          .filter(img => !img.complete)
          .map(img => new Promise(resolve => {
            img.onload = img.onerror = resolve;
          }))
      );
    });
    
    // Wait for MathJax to render
    await new Promise(resolve => setTimeout(resolve, 3000));

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
