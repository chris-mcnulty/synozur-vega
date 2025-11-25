const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const zip = new AdmZip();
const sourceDir = path.join(__dirname, 'attached_assets', 'viva_goals_export');
const outputFile = path.join(sourceDir, 'viva_goals_export.zip');

// Get all JSON files
const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.json'));

// Add each file to the zip
files.forEach(file => {
  const filePath = path.join(sourceDir, file);
  zip.addLocalFile(filePath);
});

// Write the zip file
zip.writeZip(outputFile);
console.log(`Created ${outputFile} with ${files.length} files`);
console.log('Files included:', files.join(', '));
