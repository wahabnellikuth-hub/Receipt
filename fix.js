const fs = require('fs');
let content = fs.readFileSync('js/app.js', 'utf8');

// Replace Number(fd.get('classId')) with fd.get('classId')
content = content.replace(/Number\(fd\.get\('classId'\)\)/g, "fd.get('classId')");

// Replace onclick handlers passing IDs without quotes
content = content.replace(/onclick="([^"]*App\.[a-zA-Z]+\()\$\{([^}]+)\}([^"]*)"/g, 'onclick="$1\\'${$2}\\'$3"');

fs.writeFileSync('js/app.js', content);
console.log('Replaced app.js content');
