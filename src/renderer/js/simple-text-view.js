/**
 * Simple Text View Controller
 * Uses existing Blockly code generation to show text representation
 */

import * as Blockly from "blockly/core";

export class SimpleTextView {
    constructor() {
        this.isTextMode = false;
        this.blocklyMain = null;
    }

    /**
     * Initialize with reference to BlocklyMain instance
     */
    initialize(blocklyMain) {
        this.blocklyMain = blocklyMain;
        this.setupEventListeners();
        console.log('Simple Text View initialized');
    }

    setupEventListeners() {
        // Use a small delay to ensure DOM is ready after console initialization
        setTimeout(() => {
            // Block mode button
            const blockModeBtn = document.getElementById('block-mode-btn');
            if (blockModeBtn) {
                blockModeBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showBlocks();
                };
                console.log('Block mode button listener attached');
            } else {
                console.warn('Block mode button not found');
            }

            // Text mode button  
            const textModeBtn = document.getElementById('text-mode-btn');
            if (textModeBtn) {
                textModeBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showText();
                };
                console.log('Text mode button listener attached');
            } else {
                console.warn('Text mode button not found');
            }

            // Convert button
            const syncBtn = document.getElementById('sync-btn');
            if (syncBtn) {
                syncBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.convertBlocksToText();
                };
                console.log('Sync button listener attached');
            } else {
                console.warn('Sync button not found');
            }

            // Export button
            const exportBtn = document.getElementById('exportCode');
            if (exportBtn) {
                exportBtn.onclick = () => this.exportCode();
            }
        }, 100);
    }

    showBlocks() {
        console.log('Switching to blocks mode');

        const blocklyDiv = document.getElementById('blocklyDiv');
        const textEditorDiv = document.getElementById('textEditorDiv');
        const blockModeBtn = document.getElementById('block-mode-btn');
        const textModeBtn = document.getElementById('text-mode-btn');

        if (blocklyDiv) blocklyDiv.style.display = 'block';
        if (textEditorDiv) textEditorDiv.style.display = 'none';

        if (blockModeBtn) {
            blockModeBtn.classList.add('active', 'blue');
        }
        if (textModeBtn) {
            textModeBtn.classList.remove('active', 'blue');
        }

        this.isTextMode = false;

        // Resize Blockly
        if (this.blocklyMain && this.blocklyMain.workspace) {
            setTimeout(() => {
                Blockly.svgResize(this.blocklyMain.workspace);
            }, 100);
        }
    }

    showText() {
        console.log('Switching to text mode');

        const blocklyDiv = document.getElementById('blocklyDiv');
        const textEditorDiv = document.getElementById('textEditorDiv');
        const blockModeBtn = document.getElementById('block-mode-btn');
        const textModeBtn = document.getElementById('text-mode-btn');

        if (blocklyDiv) blocklyDiv.style.display = 'none';
        if (textEditorDiv) textEditorDiv.style.display = 'block';

        if (textModeBtn) {
            textModeBtn.classList.add('active', 'blue');
        }
        if (blockModeBtn) {
            blockModeBtn.classList.remove('active', 'blue');
        }

        this.isTextMode = true;

        // Generate and show text
        this.convertBlocksToText();
    }

    convertBlocksToText() {
        console.log('Converting blocks to text');

        if (!this.blocklyMain || !this.blocklyMain.workspace) {
            console.error('Blockly workspace not available');
            return;
        }

        try {
            // Use the existing code generation from BlocklyMain
            this.blocklyMain.generateLatestCode();
            const jsCode = this.blocklyMain.latestCode || this.blocklyMain.getLatestCode();

            // Convert to more readable format
            const readableCode = this.makeCodeReadable(jsCode);

            // Show in text editor div
            let textEditorDiv = document.getElementById('textEditorDiv');
            if (!textEditorDiv) {
                console.error('Text editor div not found');
                return;
            }

            // Create simple text display if it doesn't exist
            let codeDisplay = textEditorDiv.querySelector('.code-display');
            if (!codeDisplay) {
                codeDisplay = document.createElement('pre');
                codeDisplay.className = 'code-display';
                codeDisplay.style.cssText = `
          background: #2d2d2d;
          color: #f8f8f2;
          padding: 20px;
          margin: 0;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          line-height: 1.4;
          overflow: auto;
          height: 100%;
          white-space: pre-wrap;
          border: none;
        `;
                textEditorDiv.innerHTML = '';
                textEditorDiv.appendChild(codeDisplay);
            }

            codeDisplay.textContent = readableCode;

            this.showMessage('Blocks converted to text!', 'success');

        } catch (error) {
            console.error('Error converting blocks:', error);
            this.showMessage('Error converting blocks: ' + error.message, 'error');
        }
    }

    makeCodeReadable(jsCode) {
        if (!jsCode || !jsCode.trim()) {
            return '# No blocks in workspace\n# Add some blocks in the visual editor and click Convert!';
        }

        let readable = '# Generated from your visual blocks\n';
        readable += '# This shows the executable code equivalent\n\n';

        // Basic cleanup to make JavaScript more readable
        let cleaned = jsCode
            .replace(/highlightBlock\([^)]+\);\s*/g, '') // Remove highlight calls
            .replace(/var\s+/g, '') // Remove var declarations
            .replace(/;\s*\n/g, '\n') // Remove semicolons at line ends
            .replace(/;$/gm, '') // Remove trailing semicolons
            .replace(/window\.electronAPI\.sendCommand/g, 'send_command') // Make function calls readable
            .replace(/console\.log/g, 'print') // Convert to print
            .trim();

        readable += cleaned;

        return readable;
    }

    exportCode() {
        console.log('Exporting code');

        const codeDisplay = document.querySelector('.code-display');
        const code = codeDisplay ? codeDisplay.textContent : this.getCurrentCode();

        if (!code || !code.trim() || code.includes('No blocks in workspace')) {
            this.showMessage('No code to export. Add some blocks first!', 'warning');
            return;
        }

        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'neuroscope_blocks_code.py';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showMessage('Code exported successfully!', 'success');
    }

    getCurrentCode() {
        if (this.blocklyMain) {
            this.blocklyMain.generateLatestCode();
            return this.makeCodeReadable(this.blocklyMain.latestCode || '');
        }
        return '';
    }

    showMessage(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);

        // Create toast message
        const toast = document.createElement('div');
        toast.className = `ui ${type} message`;
        toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      max-width: 300px;
      animation: slideIn 0.3s ease;
    `;
        toast.innerHTML = `
      <i class="close icon" onclick="this.parentElement.remove()"></i>
      <div class="header">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
      <p>${message}</p>
    `;

        document.body.appendChild(toast);

        // Auto remove after 4 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 4000);
    }
}

// Export singleton
export const simpleTextView = new SimpleTextView();