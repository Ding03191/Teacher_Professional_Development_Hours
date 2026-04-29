const fs = require('fs');
const code = fs.readFileSync('frontEnd/src/js/history_detail.js', 'utf8');
const lines = code.split('\n');

// Binary search for the error line
function checkUpTo(n) {
  try {
    new Function(lines.slice(0, n).join('\n'));
    return true;
  } catch(e) {
    return false;
  }
}

let lo = 1, hi = lines.length;
while (lo < hi) {
  const mid = Math.floor((lo + hi) / 2);
  if (checkUpTo(mid)) {
    lo = mid + 1;
  } else {
    hi = mid;
  }
}

console.log('First problematic line:', lo);
// Show context
for (let i = Math.max(0, lo - 5); i < Math.min(lines.length, lo + 3); i++) {
  console.log(`${i+1}: ${JSON.stringify(lines[i].substring(0, 150))}`);
}
