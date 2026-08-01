const fs = require('fs');

const filePath = 'Transactions.jsx';
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Remove states
content = content.replace(/\/\/ Order Form Config state[\s\S]*?const tagInputRef = useRef\(null\);/, '');

// 2. Remove TAG_PRESETS
content = content.replace(/\/\/ Quick-add tag presets[\s\S]*?\}\];/, '');

// 3. Remove fetch calls from useEffect
content = content.replace(/fetchPackages\(\);\s*/, '');
content = content.replace(/fetchPendingForms\(\);\s*/, '');
content = content.replace(/if \(data\.type === 'order_form_update'\) \{\s*fetchPendingForms\(\);\s*\}/, '');

// 4. Remove useEffect for selectedPackageId
content = content.replace(/useEffect\(\(\) => \{\s*fetchFormFields\(\);\s*\}, \[selectedPackageId\]\);/, '');

// 5. Remove fetch logic methods
content = content.replace(/const fetchPackages = async \(\) => \{[\s\S]*?setShowFieldModal\(true\);\s*\};/, '');

// 6. Remove UI block for Order Form Config
const startText = '{/* ───────── ORDER FORM CONFIG SECTION ───────── */}';
const endText = '{/* FIELD MODAL */}';
const startIndex = content.indexOf(startText);
const endIndex = content.indexOf(endText);

if (startIndex !== -1 && endIndex !== -1) {
  // We also need to remove the FIELD MODAL block up to its closing tag.
  // The easiest way is to find the next closing braces for the modal.
  const afterModal = content.indexOf('</div>\n      )}', endIndex);
  if (afterModal !== -1) {
    const endOfModal = afterModal + '</div>\n      )}'.length;
    content = content.substring(0, startIndex) + content.substring(endOfModal);
  }
}

fs.writeFileSync(filePath, content);
console.log('Cleanup script executed successfully!');
