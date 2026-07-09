/**
 * Apply ESLint suggested fixes from lint.json (exhaustive-deps etc.)
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const lintFile = path.join(ROOT, 'lint.json');

if (!fs.existsSync(lintFile)) {
  console.error('Run: pnpm exec eslint src --format json -o lint.json');
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(lintFile, 'utf8'));
const editsByFile = new Map();

for (const file of results) {
  if (!file.messages?.length) continue;
  const filePath = file.filePath;
  for (const msg of file.messages) {
    const fix = msg.suggestions?.[0]?.fix;
    if (!fix) continue;
    if (!editsByFile.has(filePath)) editsByFile.set(filePath, []);
    editsByFile.get(filePath).push({
      start: fix.range[0],
      end: fix.range[1],
      text: fix.text,
      rule: msg.ruleId,
      line: msg.line,
    });
  }
}

let applied = 0;
for (const [filePath, edits] of editsByFile) {
  let content = fs.readFileSync(filePath, 'utf8');
  edits.sort((a, b) => b.start - a.start);
  for (const edit of edits) {
    content = content.slice(0, edit.start) + edit.text + content.slice(edit.end);
    applied++;
    console.log('fixed:', path.relative(ROOT, filePath), edit.line, edit.rule);
  }
  fs.writeFileSync(filePath, content);
}

console.log(`Applied ${applied} suggested fix(es) across ${editsByFile.size} file(s)`);
