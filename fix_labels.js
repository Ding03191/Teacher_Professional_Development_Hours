const fs = require('fs');

let code = fs.readFileSync('frontEnd/src/js/history_detail.js', 'utf8');
const lines = code.split('\n');

// Strategy: find lines where a string is opened but not properly closed
// Specifically the pattern: label: "...CORRUPTED, type: "
// The fix: add " before ", type: on those lines

let fixCount = 0;
const fixedLines = lines.map((line, i) => {
  // Match lines with label: "..." where the closing quote is missing before ", type:"
  // Pattern: label: "some text, type: "something"
  // Should be:  label: "some text", type: "something"
  
  // Check if this looks like a field definition line with a broken label
  if (/key:.*label:/.test(line) && /type:/.test(line)) {
    // Count quotes in the line
    // A properly quoted label has pattern: label: "...", type:
    // A broken one has:                   label: "..., type: (missing closing ")
    
    // Find where label: " starts
    const labelMatch = line.match(/label: "(.+?)", type:/);
    if (labelMatch) return line; // already properly closed
    
    // Try to find the broken pattern: label: "...X, type: where X has corrupted chars
    const brokenMatch = line.match(/(label: ")(.+?)(, type:)/);
    if (brokenMatch) {
      // The label string is not closed - add closing quote
      const fixed = line.replace(/(label: ")(.+?)(, type:)/, '$1$2"$3');
      console.log(`Line ${i+1}: Fixed label: ${JSON.stringify(line.trim().substring(0,60))}`);
      fixCount++;
      return fixed;
    }
  }
  
  // Fix: if (s === "rejected") return "退件"; -- the "退件" might be broken
  if (line.includes('s === "rejected"') && line.includes('return "') && !line.includes('";')) {
    const fixed = line.replace(/(return "[^"]*)(;)/, '$1"$2');
    if (fixed !== line) {
      console.log(`Line ${i+1}: Fixed return string`);
      fixCount++;
      return fixed;
    }
  }
  
  // Fix other unclosed return strings
  if (/return "/.test(line) && !/return ".*";/.test(line) && !/return `/.test(line)) {
    // Check if the string is unclosed
    const returnMatch = line.match(/(return ")(.*?)([^"\\])(;)/);
    if (returnMatch && !line.includes('";')) {
      const fixed = line.replace(/(return ")([^"]*)(;)/, '$1$2"$3');
      if (fixed !== line) {
        console.log(`Line ${i+1}: Fixed unclosed return string`);
        fixCount++;
        return fixed;
      }
    }
  }
  
  return line;
});

code = fixedLines.join('\n');

// Verify
try {
  new Function(code);
  console.log(`\nSyntax OK! Fixed ${fixCount} lines.`);
  fs.writeFileSync('frontEnd/src/js/history_detail.js', code, 'utf8');
  console.log('File saved.');
} catch(e) {
  console.log(`Still has error: ${e.message}`);
  // Find the exact problem
  const errLineMatch = e.message.match(/line (\d+)/);
  if (errLineMatch) {
    const errLine = parseInt(errLineMatch[1]);
    const ls = code.split('\n');
    console.log(`Problem around line ${errLine}:`);
    for (let i = Math.max(0, errLine-3); i < Math.min(ls.length, errLine+3); i++) {
      console.log(`  ${i+1}: ${JSON.stringify(ls[i].substring(0,120))}`);
    }
  }
  // Save anyway to check progress
  fs.writeFileSync('frontEnd/src/js/history_detail.js', code, 'utf8');
}
