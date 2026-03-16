const input = document.getElementById('char-input');

input.addEventListener('keydown', e => {
    if (e.key === 'Enter') process();
});

input.addEventListener('input', () => {
    // Keep only last character typed (for IME input)
    const v = input.value;
    if (v.length > 1) input.value = v[v.length - 1];
});

let currentCh = '';
let currentMatrix = [];

function setFormat() {
    if (currentCh) renderOutput(currentCh, currentMatrix);
}

function process() {
    const ch = input.value.trim();
    if (!ch || ch.length === 0) return;

    currentCh = ch;
    currentMatrix = renderToMatrix(ch);
    renderOutput(currentCh, currentMatrix);
}

function renderToMatrix(ch) {
    const canvas = document.getElementById('render-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    ctx.clearRect(0, 0, 32, 32);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 32, 32);

    ctx.fillStyle = '#ffffff';
    ctx.font = '32px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, 16, 16);

    const imageData = ctx.getImageData(0, 0, 32, 32);
    const data = imageData.data;

    let matrix = [];
    for (let row = 0; row < 32; row++) {
        const rowBits = [];
        for (let col = 0; col < 32; col++) {
            const idx = (row * 32 + col) * 4;
            rowBits.push(data[idx] > 128 ? 1 : 0);
        }
        matrix.push(rowBits);
    }
    
    return matrix;
}

// Zhang-Suen thinning algorithm to reduce matrix lines to 1-pixel thickness
function applyZhangSuenThinning(grid) {
    let width = grid[0].length;
    let height = grid.length;
    let hasChanged = true;

    const safeGet = (r, c) => (r >= 0 && r < height && c >= 0 && c < width) ? grid[r][c] : 0;

    while (hasChanged) {
        hasChanged = false;
        let toClear = [];

        // Step 1
        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                if (grid[r][c] === 1) {
                    let p2 = safeGet(r - 1, c);
                    let p3 = safeGet(r - 1, c + 1);
                    let p4 = safeGet(r, c + 1);
                    let p5 = safeGet(r + 1, c + 1);
                    let p6 = safeGet(r + 1, c);
                    let p7 = safeGet(r + 1, c - 1);
                    let p8 = safeGet(r, c - 1);
                    let p9 = safeGet(r - 1, c - 1);

                    let A = (p2 === 0 && p3 === 1) + (p3 === 0 && p4 === 1) +
                            (p4 === 0 && p5 === 1) + (p5 === 0 && p6 === 1) +
                            (p6 === 0 && p7 === 1) + (p7 === 0 && p8 === 1) +
                            (p8 === 0 && p9 === 1) + (p9 === 0 && p2 === 1);
                    let B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;

                    if (B >= 2 && B <= 6 && A === 1 && (p2 * p4 * p6 === 0) && (p4 * p6 * p8 === 0)) {
                        toClear.push([r, c]);
                        hasChanged = true;
                    }
                }
            }
        }
        toClear.forEach(([r, c]) => grid[r][c] = 0);
        toClear = [];

        // Step 2
        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                if (grid[r][c] === 1) {
                    let p2 = safeGet(r - 1, c);
                    let p3 = safeGet(r - 1, c + 1);
                    let p4 = safeGet(r, c + 1);
                    let p5 = safeGet(r + 1, c + 1);
                    let p6 = safeGet(r + 1, c);
                    let p7 = safeGet(r + 1, c - 1);
                    let p8 = safeGet(r, c - 1);
                    let p9 = safeGet(r - 1, c - 1);

                    let A = (p2 === 0 && p3 === 1) + (p3 === 0 && p4 === 1) +
                            (p4 === 0 && p5 === 1) + (p5 === 0 && p6 === 1) +
                            (p6 === 0 && p7 === 1) + (p7 === 0 && p8 === 1) +
                            (p8 === 0 && p9 === 1) + (p9 === 0 && p2 === 1);
                    let B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;

                    if (B >= 2 && B <= 6 && A === 1 && (p2 * p4 * p8 === 0) && (p2 * p6 * p8 === 0)) {
                        toClear.push([r, c]);
                        hasChanged = true;
                    }
                }
            }
        }
        toClear.forEach(([r, c]) => grid[r][c] = 0);
    }
    return grid;
}

function generateCode(ch, matrix) {
    const format = document.querySelector('input[name="fmt"]:checked').value;
    const codePoint = ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    const varName = `char_U${codePoint}`;

    const hexRows32 = matrix.map(row => {
        let hexStr = '';
        for (let b = 0; b < 4; b++) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
                byte = (byte << 1) | row[b * 8 + bit];
            }
            hexStr += byte.toString(16).padStart(2, '0');
        }
        const compressedHex = parseInt(hexStr, 16).toString(16).toUpperCase();
        return `0x${compressedHex}`;
    });

    if (format === 'c' || format === 'cpp') {
        const modifier = format === 'cpp' ? 'constexpr ' : 'static const ';
        const chunks = [];
        for(let i=0; i<hexRows32.length; i+=8) chunks.push('    ' + hexRows32.slice(i, i+8).join(', '));
        return `/* ${ch} (U+${codePoint}) */\n${modifier}uint32_t ${varName}[32] = {\n${chunks.join(',\n')}\n};`;
    } else if (format === 'py') {
        const chunks = [];
        for(let i=0; i<hexRows32.length; i+=8) chunks.push('    ' + hexRows32.slice(i, i+8).join(', '));
        return `# ${ch}\n${varName} = [\n${chunks.join(',\n')}\n]`;
    } else if (format === 'js') {
        const chunks = [];
        for(let i=0; i<hexRows32.length; i+=8) chunks.push('    ' + hexRows32.slice(i, i+8).join(', '));
        return `// ${ch}\nconst ${varName} = [\n${chunks.join(',\n')}\n];`;
    } else if (format === 'ascii') {
        return matrix.map(row => row.join('')).join('\n');
    } else if (format === 'md') {
        return '\`\`\`text\n' + matrix.map(row => row.join('')).join('\n') + '\n\`\`\`';
    }
}

function renderOutput(ch, matrix) {
    const area = document.getElementById('output-area');

    // Build matrix grid cells HTML
    const cells = matrix.flat().map(b =>
        `<div class="cell ${b ? 'on' : 'off'}"></div>`
    ).join('');

    const codeOutput = generateCode(ch, matrix);

    area.innerHTML = `
<div class="preview-row">
<div class="preview-section">
  <span class="section-label">Matrix Preview (32×32)</span>
  <div id="matrix-grid">${cells}</div>
</div>
<div class="preview-section" style="align-items:flex-start; flex:1; min-width:240px;">
  <span class="section-label">Raw Bit Grid</span>
  <pre id="raw-grid" style="font-size:0.6rem; line-height:1.15;">${matrix.map(r => r.join('')).join('\n')}</pre>
</div>
</div>
<div class="code-section">
<div class="code-header">
  <span class="section-label">Code Output</span>
  <button class="copy-btn" onclick="copyCode()">Copy</button>
</div>
<pre id="code-output">${escapeHtml(codeOutput)}</pre>
</div>
`;
}

function copyCode() {
    const pre = document.getElementById('code-output');
    navigator.clipboard.writeText(pre.innerText).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1800);
    });
}

function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
